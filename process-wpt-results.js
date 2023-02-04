import { readFileSync } from 'fs';

export function process_raw_results(raw_results) {
  const test_scores = {}
  const run_info = raw_results.run_info

  for (const test of raw_results.results) {
    const test_name = test.test;
    const test_status = test.status;

    const test_score = {
      score: test_status === "PASS" ? 1 : 0,
      subtests: {}
    }

    test_scores[test_name] = test_score

    for (const subtest of test.subtests) {
      test_score.subtests[subtest.name] = {
        score: subtest.status === "PASS" ? 1 : 0 
      }
    }
  }

  return { run_info, test_scores }
}

export function score_run(run, against_run) {
  let total_score = 0;
  let total_tests = 0;

  for (const [test, { subtests }] of Object.entries(against_run.test_scores)) {
    total_tests += 1;
    const run_test = run.test_scores[test];

    // score new tests not present in older runs
    if (!run_test) continue;

    const subtest_names = Object.keys(subtests)
    if (!subtest_names.length) {
      total_score += run_test.score
    } else {
      let test_score = 0;
      for (const subtest of subtest_names) {
        if (run_test.subtests[subtest])  {
          test_score += run_test.subtests[subtest].score
        }
      }
      test_score /= subtest_names.length
      total_score += test_score
    }
  }

  return Math.floor(1000 * total_score/total_tests)
}
