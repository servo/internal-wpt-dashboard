import { score_run, process_raw_results } from '../process-wpt-results.js'
import { strict as assert } from 'assert'

describe('Process wpt result', () => {
  it('correctly transforms simple wpt results', () => {
    const raw_result = {
      run_info: {
        product: "servo",
        revision: "commitSha",
        os: "Ubuntu"
      },
      results: [
        {
          test: "test1",
          status: "PASS",
          subtests: []
        },
        {
          test: "test2",
          status: "ERROR",
          subtests: [
            {
              name: "subtest1",
              status: "PASS"
            },
            {
              name: "subtest2",
              status: "FAIL"
            }
          ]
        }
      ]
    }

    const processed = process_raw_results(raw_result)
    assert.deepEqual(processed, {
      run_info: raw_result.run_info,
      test_scores: {
        test1: {
          score: 1,
          subtests: {}
        },
        test2: {
          score: 0,
          subtests: {
            subtest1: { score: 1 },
            subtest2: { score: 0 }
          }
        }
      }
    })
  })
})

describe('Scoring', () => {
  it('calculates scores for individual tests', () => {
    const run = {
      test_scores: {
        test1: {
          score: 1,
          subtests: {}
        },
        test2: {
          score: 1,
          subtests: {}
        }
      }
    }

    let score = score_run(run, run)
    assert.equal(score, 1000)

    run.test_scores.test2.score = 0
    score = score_run(run, run)
    assert.equal(score, 500)
  })
  it('calculates scores for subtests', () => {
    const run = {
      test_scores: {
        test1: {
          score: 0,
          subtests: {
            subtest1: { score: 1 },
            subtest2: { score: 1 },
            subtest3: { score: 1 },
          }
        }
      }
    }

    const score = score_run(run, run)
    assert.equal(score, 1000)
  })
  it('calculates scores for subtests by averaging', () => {
    const run = {
      test_scores: {
        test1: {
          score: 0,
          subtests: {
            subtest1: { score: 1 },
            subtest2: { score: 0 },
            subtest3: { score: 0 },
          }
        }
      }
    }

    const score = score_run(run, run)
    assert.equal(score, 333) 
  })
  it('calculates scores based only on tests in new runs', () => {
    const old_run = {
      test_scores: {
        test1: { score: 1, subtests: {} },
        test3: { score: 0, subtests: {} }
      }
    }
    const new_run = {
      test_scores: {
        test2: { score: 1, subtests: {} },
        test3: { score: 1, subtests: {} }
      }
    }

    let score = score_run(old_run, new_run)
    assert.equal(score, 0) 

    old_run.test_scores.test3.score = 1
    score = score_run(old_run, new_run) 
    assert.equal(score, 500) 
  })
});
