const core = require('@actions/core');
const client = require('@actions/http-client');

// The user agent of Microsoft Edge.
const HTTP_CLIENT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/120.0.2210.160';
const HTTP_CLIENT_HANDLERS = [
];
const HTTP_CLIENT_OPTIONS = {
  headers: {
    Cookie: `ustspace_session=${core.getInput('session')};`,
  },
  allowRetries: true,
  maxRetries: 10,
};
const BASE = 'https://ust.space/';

const CLIENT = new client.HttpClient(
  HTTP_CLIENT_USER_AGENT,
  HTTP_CLIENT_HANDLERS,
  HTTP_CLIENT_OPTIONS,
);

function urlOf(base, path, query) {
  const url = new URL(path, base);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      url.searchParams.append(key, value.toString());
    });
  }
  return url;
}

async function fetchSubjects() {
  const resp = await CLIENT.getJson(urlOf(BASE, 'selector/query/', {
    page: 'review',
    type: 'default',
    value: '',
  }).toString());
  if (resp.result.error) {
    throw new Error(`fetchSubjects: ${resp.result}`);
  }
  return resp.result.list
    .filter((subjectObj) => subjectObj.type === 'subject')
    .map((subjectObj) => ({
      title: subjectObj.title,
      value: subjectObj.value,
    }));
}

async function fetchCourses(subject) {
  const resp = await CLIENT.getJson(urlOf(BASE, 'selector/query/', {
    page: 'review',
    type: 'subject',
    value: subject,
  }).toString());
  if (resp.result.error) {
    throw new Error(`fetchCourses: ${resp.result}`);
  }
  return resp.result.list
    .filter((courseObj) => courseObj.type === 'course-review')
    .map((courseObj) => ({
      title: courseObj.title,
      subtitle: courseObj.subtitle,
      value: courseObj.value,
    }));
}

async function fetchReviews(course) {
  const resp = await CLIENT.getJson(urlOf(BASE, `review/${course}/get`, {
    'preferences[sort]': 1, // sort by post-date
  }).toString());
  if (resp.result.error) {
    throw new Error(`fetchReviews: ${resp.result}`);
  }
  const courseObj = resp.result.course;
  const reviewsObj = resp.result.reviews
    .map((reviewObj) => ({
      hash: reviewObj.hash,
      semester: reviewObj.semester,
      instructors: reviewObj.instructors,
      author: reviewObj.author,
      date: reviewObj.date,
      title: reviewObj.title,
      comment_content: reviewObj.comment_content,
      comment_teaching: reviewObj.comment_teaching,
      comment_grading: reviewObj.comment_grading,
      comment_workload: reviewObj.comment_workload,
      rating_content: reviewObj.rating_content,
      rating_teaching: reviewObj.rating_teaching,
      rating_grading: reviewObj.rating_grading,
      rating_workload: reviewObj.rating_workload,
      has_midterm: reviewObj.has_midterm,
      has_final: reviewObj.has_final,
      has_quiz: reviewObj.has_quiz,
      has_assignment: reviewObj.has_assignment,
      has_essay: reviewObj.has_essay,
      has_project: reviewObj.has_project,
      has_attendance: reviewObj.has_attendance,
      has_reading: reviewObj.has_reading,
      has_presentation: reviewObj.has_presentation,
      upvote_count: reviewObj.upvote_count,
      vote_count: reviewObj.vote_count,
      comment_count: reviewObj.comment_count,
      attachments: reviewObj.attachments,
    }));
  return {
    course: courseObj,
    reviews: reviewsObj,
  };
}

module.exports = {
  fetchSubjects,
  fetchCourses,
  fetchReviews,
};
