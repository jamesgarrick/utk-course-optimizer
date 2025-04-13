// parse_utk_catalog.js
import * as cheerio from "cheerio";
import { writeFile } from "fs/promises";
import pLimit from "p-limit";

// Set debug mode flag: if true, only parse one course per page and one major.
const DEBUG = true;

/**
 * Fetches courses from a specific page of the catalog
 * @param {number} page - The page number to fetch
 * @returns {Promise<Array>} - Array of course objects
 */
async function fetchCoursesFromPage(page: number) {
  // Construct URL with filter[cpage] parameter.
  const pageUrl = `https://catalog.utk.edu/content.php?filter%5B27%5D=-1&filter%5B29%5D=&filter%5Bkeyword%5D=&filter%5B32%5D=1&filter%5Bcpage%5D=${page}&cur_cat_oid=52&expand=&navoid=10718&search_database=Filter#acalog_template_course_filter`;
  console.log(`Fetching page ${page}: ${pageUrl}`);
  const res = await fetch(pageUrl);
  if (!res.ok) {
    console.error(`Failed to fetch page ${page}:`, res.status);
    return [];
  }
  const html = await res.text();
  const $ = cheerio.load(html);

  // Select all course links; they start with href containing "preview_course_nopop.php"
  let courseAnchors = $('a[href*="preview_course_nopop.php"]');
  console.log(`Page ${page}: Found ${courseAnchors.length} course links.`);

  // In debug mode, only process the first course link.
  if (DEBUG) {
    courseAnchors = courseAnchors.slice(0, 1);
  }

  const coursePromises = courseAnchors
    .map(async (i, el) => {
      const anchor = $(el);
      const linkText = anchor.text().trim();
      console.log(`Course link ${i} on page ${page}: "${linkText}"`);
      if (!linkText) return null;

      // Use regex splitting on dash to handle whitespace variations.
      const parts = linkText.split(/\s*-\s*/);
      if (parts.length < 2) {
        console.error(
          `Skipping course link ${i} on page ${page} due to insufficient parts: "${linkText}"`
        );
        return null;
      }
      const courseCode = parts[0].trim();
      const courseTitle = parts.slice(1).join(" - ").trim();

      // Build detail page URL.
      let href = anchor.attr("href");
      if (!href) {
        console.error(`Missing href for course ${courseCode} on page ${page}`);
        return null;
      }
      if (!href.startsWith("http")) {
        href = "https://catalog.utk.edu/" + href;
      }
      console.log(
        `Page ${page}: Fetching details for course ${courseCode} from ${href}`
      );

      try {
        const detailRes = await fetch(href);
        if (!detailRes.ok) {
          console.error(
            `Failed to fetch detail for course ${courseCode}:`,
            detailRes.status
          );
          return {
            code: courseCode,
            title: courseTitle,
            description: "",
            credit_hours: undefined,
          };
        }
        const detailHtml = await detailRes.text();
        const $detail = cheerio.load(detailHtml);

        const courseTitle = $detail("h1#course_preview_title").text().trim();
        console.log("Course Title:", courseTitle);

        const creditHoursText = $detail("h1#course_preview_title")
          .nextAll("strong")
          .first()
          .text()
          .trim();
        console.log("Credit Hours Text:", creditHoursText);
        // Parse as needed – for instance, take the maximum value in a range:
        let creditHours;
        if (creditHoursText.includes("-")) {
          // If the text is a range like "1-15", split and choose the max:
          const parts = creditHoursText.split("-").map((s) => parseFloat(s));
          creditHours = Math.max(...parts);
        } else {
          creditHours = parseFloat(creditHoursText);
        }
        console.log("Parsed Credit Hours:", creditHours);

        const hrEl = $detail("h1#course_preview_title").nextAll("hr").first();
        let courseDescription = "";
        if (hrEl.length) {
          let sibling = hrEl[0].nextSibling;
          while (sibling) {
            if (sibling.type === "text") {
              // Append text and trim it.
              courseDescription += sibling.data.trim() + " ";
            } else if (sibling.type === "tag") {
              // If we hit a <br>, assume the description has ended.
              if (sibling.name === "br") break;
              // Otherwise, include the tag’s text.
              courseDescription += $detail(sibling).text().trim() + " ";
            }
            sibling = sibling.nextSibling;
          }
          courseDescription = courseDescription.trim();
        }
        console.log("Course Description:", courseDescription);

        const gradingRestrictionLabel = $detail(
          "em:contains('Grading Restriction:')"
        );
        let gradingRestriction = "";
        if (gradingRestrictionLabel.length) {
          gradingRestriction = gradingRestrictionLabel.next("em").text().trim();
        }
        console.log("Grading Restriction:", gradingRestriction);

        const repeatabilityLabel = $detail("em:contains('Repeatability:')");
        let repeatability = "";
        if (repeatabilityLabel.length) {
          repeatability = repeatabilityLabel.next("em").text().trim();
        }
        console.log("Repeatability:", repeatability);

        const creditRestrictionLabel = $detail(
          "em:contains('Credit Restriction:')"
        );
        let creditRestriction = "";
        if (creditRestrictionLabel.length) {
          creditRestriction = creditRestrictionLabel.next("em").text().trim();
        }
        console.log("Credit Restriction:", creditRestriction);

        const registrationRestrictionLabel = $detail(
          "em:contains('Registration Restriction(s):')"
        );
        let registrationRestriction = "";
        if (registrationRestrictionLabel.length) {
          registrationRestriction = registrationRestrictionLabel
            .next("em")
            .text()
            .trim();
        }
        console.log("Registration Restriction(s):", registrationRestriction);

        return {
          code: courseCode,
          title: courseTitle,
          credit_hours: creditHours,
          description: courseDescription,
          creditRestriction: creditRestriction,
          gradingRestriction: gradingRestriction,
          registrationRestriction: registrationRestriction,
          repeatability: repeatability,
        };
      } catch (err) {
        console.error(
          `Error processing course ${courseCode} on page ${page}. Link text: "${linkText}". Error:`,
          err
        );
        return {
          code: courseCode,
          title: courseTitle,
          description: "",
          credit_hours: undefined,
        };
      }
    })
    .get();

  const coursesOnPage = (await Promise.all(coursePromises)).filter(
    (c) => c !== null
  );
  console.log(`Page ${page}: Parsed ${coursesOnPage.length} courses.`);
  return coursesOnPage;
}

/**
 * Parses all courses across paginated pages in parallel
 * @returns {Promise<Array>} - Array of all course objects
 */
async function parseAllCourses() {
  // Construct first page URL.
  const firstPageUrl = `https://catalog.utk.edu/content.php?filter%5B27%5D=-1&filter%5B29%5D=&filter%5Bkeyword%5D=&filter%5B32%5D=1&filter%5Bcpage%5D=1&cur_cat_oid=52&expand=&navoid=10718&search_database=Filter#acalog_template_course_filter`;
  console.log(`Fetching first page to detect pagination: ${firstPageUrl}`);
  const res = await fetch(firstPageUrl);
  if (!res.ok) {
    console.error("Failed to fetch first page:", res.status);
    return [];
  }
  const firstHtml = await res.text();
  const $first = cheerio.load(firstHtml);

  // Look for pagination information from a table cell containing "Page:"
  const paginationCell = $first("td")
    .filter((i, el) => $first(el).text().includes("Page:"))
    .first();

  let maxPage = 1;
  if (paginationCell && paginationCell.length > 0) {
    const cellText = paginationCell.text();
    //console.log("Pagination cell text:", cellText);
    const numbers = [...cellText.matchAll(/(\d+)/g)]
      .map((match) => parseInt(match[1]))
      .filter((n) => !isNaN(n));
    if (numbers.length > 0) {
      maxPage = Math.max(...numbers);
    }
  }
  // Cap the maximum number of pages at 50.
  if (maxPage > 50) {
    console.log(`Capping max pages from ${maxPage} to 50.`);
    maxPage = 50;
  }
  console.log(`Detected ${maxPage} pages of courses.`);

  // Create an array of pages [1, 2, ..., maxPage] and process them concurrently.
  const pages = Array.from({ length: maxPage }, (_, i) => i + 1);
  // In debug mode, limit to the first page.
  const pagesToProcess = DEBUG ? [1] : pages;
  const pageLimit = pLimit(5);
  const pagePromises = pagesToProcess.map((page) =>
    pageLimit(() => fetchCoursesFromPage(page))
  );
  const coursesPages = await Promise.all(pagePromises);
  const allCourses = coursesPages.flat();
  console.log(`Total parsed courses: ${allCourses.length}`);
  return allCourses;
}

/**
 * Parses an individual major page to extract required courses (codes only) and a program description.
 * @param {string} url - URL of the major page
 * @returns {Promise<Object>} - Object containing required_courses (as an array of codes) and description
 */
async function parseMajorDetail(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error("Failed to retrieve major page:", url);
      return { required_courses: [], description: "" };
    }
    const html = await res.text();
    const $ = cheerio.load(html);
    const required_courses: string[] = [];

    // Extract program description from an element with class "content"
    let description = "";
    const contentArea = $(".content");
    if (contentArea.length > 0) {
      const firstParagraph = contentArea.find("p").first().text().trim();
      if (firstParagraph) {
        description = firstParagraph;
      } else {
        const contentText = contentArea
          .clone()
          .children("h1, h2, h3, table")
          .remove()
          .end()
          .text()
          .trim();
        if (contentText) {
          description = contentText;
        }
      }
    }

    // Find all course links on the major page; required courses are indicated by links containing 'preview_course_nopop.php'
    $('a[href*="preview_course_nopop.php"]').each((i, el) => {
      const courseLink = $(el);
      const courseLinkText = courseLink.text().trim();
      const parts = courseLinkText.split(/\s*-\s*/);
      if (parts.length >= 2) {
        const courseCode = parts[0].trim();
        required_courses.push(courseCode);
      }
    });

    console.log(
      `Parsed major detail from ${url}: found ${required_courses.length} required courses`
    );
    return { required_courses, description };
  } catch (err) {
    console.error(`Error parsing major detail from ${url}:`, err);
    return { required_courses: [], description: "" };
  }
}

/**
 * Parses the A-Z list of all majors.
 * @returns {Promise<Array>} - Array of major objects
 */
async function parseMajors() {
  const url = "https://catalog.utk.edu/content.php?catoid=51&navoid=10453";
  const res = await fetch(url);
  if (!res.ok) {
    console.error("Failed to retrieve majors page:", res.status);
    return [];
  }
  const html = await res.text();
  const $ = cheerio.load(html);
  const majors: {
    name: string;
    url: string;
    description: string;
    required_courses: string[];
  }[] = [];
  const majorLinks: { name: string; url: string }[] = [];

  // Find all anchor tags that link to individual major pages (those containing 'preview_program.php').
  $("a[href*='preview_program.php']").each((i, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    let full_url = href;
    if (!href.startsWith("http")) {
      full_url = "https://catalog.utk.edu/" + href;
    }
    const major_name = $(el).text().trim();
    if (major_name) {
      majorLinks.push({ name: major_name, url: full_url });
    }
  });

  console.log(`Found ${majorLinks.length} major links`);

  // In debug mode, only process the first major.
  const majorLinksToProcess = DEBUG ? majorLinks.slice(0, 1) : majorLinks;

  const limit = pLimit(5);
  const tasks = majorLinksToProcess.map((link) =>
    limit(async () => {
      console.log(`Parsing major: ${link.name}`);
      const detail = await parseMajorDetail(link.url);
      return {
        name: link.name,
        url: link.url,
        description: detail.description,
        required_courses: detail.required_courses, // Array of course codes
      };
    })
  );

  const results = await Promise.all(tasks);
  majors.push(...results);
  return majors;
}

// Main function to parse and write JSON files.
async function main() {
  console.log("Parsing courses...");
  const courses = await parseAllCourses();
  await writeFile("courses.json", JSON.stringify(courses, null, 2));
  console.log(`Parsed ${courses.length} courses. Data saved to courses.json`);

  console.log("Parsing majors in parallel...");
  const majors = await parseMajors();

  // No merging is needed now because major.required_courses contains only course codes.
  await writeFile("majors.json", JSON.stringify(majors, null, 2));
  console.log(`Parsed ${majors.length} majors. Data saved to majors.json`);
}

// Run the main function
main().catch((err) => console.error("Error in main execution:", err));
