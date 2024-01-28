const core = require('@actions/core');
const path = require('path');
const fs = require('fs/promises');
const { RateLimiter } = require('limiter');

const {
  fetchSubjects, fetchCourses, fetchReviews, login,
} = require('./ust.space');

const limiter = new RateLimiter({
  tokensPerInterval: core.getInput('rate'),
  interval: 'second',
});

async function save(obj, file) {
  const dir = path.dirname(file);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(file, JSON.stringify(obj, null, 2));
}

async function go() {
  await login(core.getInput('username'), core.getInput('password'));

  const subjects = await fetchSubjects();
  core.info(`subjects: ${JSON.stringify(subjects.map((s) => s.title))}`);

  const promises = subjects.map(async (subject) => {
    await limiter.removeTokens(1);
    const courses = await fetchCourses(subject.value);
    core.info(`courses of ${subject.value}: ${courses.map((c) => c.title)}`);

    return courses.map(async (course) => {
      await limiter.removeTokens(1);
      const reviews = await fetchReviews(course.value);
      core.info(`reviews of ${course.value}: ${reviews.reviews.length}`);

      return save(reviews, path.join('data', subject.value, `${course.value}.json`));
    });
  })
    .flat(Infinity);

  return Promise.all(promises);
}

async function run() {
  try {
    await go();
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
