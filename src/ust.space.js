const core = require('@actions/core');
const axios = require('axios');
const axiosRetry = require('axios-retry');
const axoisCookie = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const { JSDOM } = require('jsdom');

// The user agent of Microsoft Edge.
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/120.0.2210.160';
const BASE = 'https://ust.space/';

const withCookie = axoisCookie.wrapper;
const attachRetry = axiosRetry.default;

const cookieJar = new CookieJar(null);
const client = withCookie(axios.create({
  headers: {
    'User-Agent': USER_AGENT,
  },
  jar: cookieJar,
}));
attachRetry(client, {
  retries: 30,
  retryDelay: axiosRetry.exponentialDelay,

  onRetry: (retryCount, error, requestConfig) => {
    core.info(`Retrying the request ${requestConfig.url} because of error ${error}`);
  },
});

function urlOf(base, path, query) {
  const url = new URL(path, base);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      url.searchParams.append(key, value.toString());
    });
  }
  return url.toString();
}

async function login(username, password) {
  const pageResp = await client.get(urlOf(BASE, 'login').toString());
  const pageDom = new JSDOM(pageResp.data);
  const token = pageDom.window.document.querySelector('input[name=_token]').value;

  const form = new FormData();
  form.append('_token', token);
  form.append('username', username);
  form.append('password', password);
  await client.post(urlOf(BASE, 'login').toString(), form);

  // The credential cookies will be set if the login is successful.
}

async function fetchSubjects() {
  const resp = await client.get(urlOf(BASE, 'selector/query/', {
    page: 'review',
    type: 'default',
    value: '',
  }).toString());
  const { data } = resp;
  if (data.error) {
    throw new Error(`fetchSubjects: ${data}`);
  }
  return data.list
    .filter((subjectObj) => subjectObj.type === 'subject')
    .map((subjectObj) => ({
      title: subjectObj.title,
      value: subjectObj.value,
    }));
}

async function fetchCourses(subject) {
  const resp = await client.get(urlOf(BASE, 'selector/query/', {
    page: 'review',
    type: 'subject',
    value: subject,
  }).toString());
  const { data } = resp;
  if (data.error) {
    throw new Error(`fetchCourses: ${data}`);
  }
  return data.list
    .filter((courseObj) => courseObj.type === 'course-review')
    .map((courseObj) => ({
      title: courseObj.title,
      subtitle: courseObj.subtitle,
      value: courseObj.value,
    }));
}

async function fetchReviews(course) {
  const resp = await client.get(urlOf(BASE, `review/${course}/get`, {
    'preferences[sort]': 1, // sort by post-date
  }).toString());
  const { data } = resp;
  if (data.error) {
    throw new Error(`fetchReviews: ${data}`);
  }
  const courseObj = data.course;
  const reviewsObj = data.reviews
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
  login,
  fetchSubjects,
  fetchCourses,
  fetchReviews,
};
