/* eslint-env mocha */

import {
    get_focus_areas,
    merge_nonoverlap,
    score_run,
    process_raw_results,
    focus_areas_map
} from '../process-wpt-results.js'
import { strict as assert } from 'assert'

describe('merge_nonoverlap', () => {
    it('merges simple objects', () => {
        const obj1 = {
            foo: 'bar',
            id: 1
        }
        const obj2 = {
            key: 'value'
        }

        assert.deepEqual(merge_nonoverlap(obj1, obj2), {
            foo: 'bar',
            id: 1,
            key: 'value'
        })
    })
    it('merges nested objects', () => {
        const obj1 = {
            foo: 'bar',
            id: 1,
            sub1: {
                sub11: 10,
                sub13: {
                    k: 1
                }
            }
        }
        const obj2 = {
            key: 'value',
            sub1: {
                sub12: 20,
                sub13: {
                    v: 2
                }
            }
        }

        assert.deepEqual(merge_nonoverlap(obj1, obj2), {
            foo: 'bar',
            id: 1,
            key: 'value',
            sub1: {
                sub11: 10,
                sub12: 20,
                sub13: {
                    k: 1,
                    v: 2
                }
            }
        })
    })
    it('must obey identity rule', () => {
        let result = merge_nonoverlap({}, { a: { x: {} } })
        assert.deepEqual(result, { a: { x: {} } })
        result = merge_nonoverlap({ a: { x: {} } }, {})
        assert.deepEqual(result, { a: { x: {} } })
    })

    it('doesnt merge objects with arrays', () => {
        try {
            merge_nonoverlap({ a: { x: [] } }, {})
            throw new Error()
        } catch (e) {
            assert.equal(e.toString(),
                "AssertionError [ERR_ASSERTION]: Key x - arrays can't be merged")
        }
    })
    it('doesnt merge objects with arrays 2', () => {
        try {
            merge_nonoverlap({}, { a: { x: [] } })
            throw new Error()
        } catch (e) {
            assert.equal(e.toString(),
                "AssertionError [ERR_ASSERTION]: Key x - arrays can't be merged")
        }
    })
    it('doesnt merge objects with overlapping keys', () => {
        try {
            merge_nonoverlap({ a: { x: 1 } }, { a: { x: 2 } })
            throw new Error()
        } catch (e) {
            assert.equal(e.toString(),
                'AssertionError [ERR_ASSERTION]: Key x overlaps')
        }
    })
})

describe('Process wpt result', () => {
    it('correctly transforms simple wpt results', () => {
        const raw_result = {
            run_info: {
                product: 'servo',
                revision: 'commitSha',
                os: 'Ubuntu'
            },
            results: [
                {
                    test: 'test1',
                    status: 'PASS',
                    subtests: []
                },
                {
                    test: 'test2',
                    status: 'ERROR',
                    subtests: [
                        {
                            name: 'subtest1',
                            status: 'PASS'
                        },
                        {
                            name: 'subtest2',
                            status: 'FAIL'
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

function checkScore (actual, expected) {
    actual.per_mille = Math.floor(1000 * actual.total_score / actual.total_tests)
    actual.per_mille_subtests = Math.floor(1000 * actual.total_subtests_passed / actual.total_subtests)
    assert.deepEqual(actual, expected)
}

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

        const index = 0
        const focus_area_map = {
            test1: [index],
            test2: [index]
        }
        let score = score_run(run, run, focus_area_map)
        checkScore(score[index],
            {
                total_tests: 2,
                total_score: 2,
                per_mille: 1000,
                total_subtests: 2,
                total_subtests_passed: 2,
                per_mille_subtests: 1000
            })

        run.test_scores.test2.score = 0
        score = score_run(run, run, focus_area_map)
        checkScore(score[index],
            {
                total_tests: 2,
                total_score: 1,
                per_mille: 500,
                total_subtests: 2,
                total_subtests_passed: 1,
                per_mille_subtests: 500
            })
    })
    it('calculates subtests count', () => {
        const run = {
            test_scores: {
                test1: {
                    score: 1,
                    subtests: {
                        subtest1: { score: 1 },
                        subtest2: { score: 1 },
                        subtest3: { score: 1 }
                    }
                },
                test2: {
                    score: 0,
                    subtests: {
                        subtest1: { score: 1 },
                        subtest2: { score: 0 }
                    }
                }
            }
        }

        const index = 0
        const focus_area_map = {
            test1: [index],
            test2: [index]
        }
        const score = score_run(run, run, focus_area_map)
        checkScore(score[index],
            {
                total_tests: 2,
                total_score: 1.5,
                per_mille: 750,
                total_subtests: 5,
                total_subtests_passed: 4,
                per_mille_subtests: 800
            })
    })
    it('calculates subtests counts with simple tests', () => {
        const run = {
            test_scores: {
                test1: {
                    score: 1,
                    subtests: {
                        subtest1: { score: 1 },
                        subtest2: { score: 1 },
                        subtest3: { score: 1 }
                    }
                },
                test2: {
                    score: 0,
                    subtests: {
                        subtest1: { score: 1 },
                        subtest2: { score: 0 }
                    }
                },
                test3: {
                    score: 1,
                    subtests: {}
                },
                test4: {
                    score: 0,
                    subtests: {}
                }
            }
        }

        const index = 0
        const focus_area_map = {
            test1: [index],
            test2: [index],
            test3: [index],
            test4: [index]
        }
        const score = score_run(run, run, focus_area_map)
        checkScore(score[index],
            {
                total_tests: 4,
                total_score: 2.5,
                per_mille: 625,
                total_subtests: 7,
                total_subtests_passed: 5,
                per_mille_subtests: 714
            })
    })
    it('calculates scores for subtests', () => {
        const run = {
            test_scores: {
                test1: {
                    score: 0,
                    subtests: {
                        subtest1: { score: 1 },
                        subtest2: { score: 1 },
                        subtest3: { score: 1 }
                    }
                }
            }
        }

        const index = 0
        const score = score_run(run, run, { test1: [index] })
        checkScore(score[index],
            {
                total_tests: 1,
                total_score: 1,
                per_mille: 1000,
                total_subtests: 3,
                total_subtests_passed: 3,
                per_mille_subtests: 1000
            })
    })
    it('calculates scores for subtests by averaging', () => {
        const run = {
            test_scores: {
                test1: {
                    score: 0,
                    subtests: {
                        subtest1: { score: 1 },
                        subtest2: { score: 0 },
                        subtest3: { score: 0 }
                    }
                }
            }
        }

        const index = 0
        const score = score_run(run, run, { test1: [index] })
        checkScore(score[index],
            {
                total_tests: 1,
                total_score: 1 / 3,
                per_mille: 333,
                total_subtests: 3,
                total_subtests_passed: 1,
                per_mille_subtests: 333
            })
    })
    it('calculates scores correctly even subtest name collides with JS builtins', () => {
        const run = {
            test_scores: {
                test1: {
                    score: 0,
                    subtests: {
                    }
                },
                test2: {
                    score: 1,
                    subtests: { }
                }
            }
        }

        const against_run = {
            test_scores: {
                test1: {
                    score: 1,
                    subtests: {
                        toString: { score: 1 }
                    }
                },
                test2: {
                    score: 1,
                    subtests: { }
                }
            }
        }

        const index = 0
        const score = score_run(run, against_run, { test1: [index], test2: [index] })
        checkScore(score[index],
            {
                total_tests: 2,
                total_score: 1,
                per_mille: 500,
                total_subtests: 2,
                total_subtests_passed: 1,
                per_mille_subtests: 500
            })
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

        const index = 0
        const all = [index]
        const focus_map = {
            test1: all, test2: all, test3: all
        }
        let score = score_run(old_run, new_run, focus_map)
        checkScore(score[index],
            {
                total_tests: 2,
                total_score: 0,
                per_mille: 0,
                total_subtests: 2,
                total_subtests_passed: 0,
                per_mille_subtests: 0
            })
        old_run.test_scores.test3.score = 1
        score = score_run(old_run, new_run, focus_map)
        checkScore(score[index],
            {
                total_tests: 2,
                total_score: 1,
                per_mille: 500,
                total_subtests: 2,
                total_subtests_passed: 1,
                per_mille_subtests: 500
            })
    })
    it('calculates scores based only on subtests in new runs', () => {
        const old_run = {
            test_scores: {
                test1: {
                    score: 0,
                    subtests: {
                        subtest1: { score: 1 },
                        subtest2: { score: 0 }
                    }
                },
                test3: {
                    score: 0,
                    subtests: {
                        subtest1: { score: 0 },
                        subtest2: { score: 1 }
                    }
                }
            }
        }
        const new_run = {
            test_scores: {
                test2: {
                    score: 1,
                    subtests: {
                        subtest1: { score: 1 },
                        subtest2: { score: 1 },
                        subtest3: { score: 1 },
                        subtest4: { score: 1 }
                    }
                },
                test3: {
                    score: 1,
                    subtests: {
                        subtest1: { score: 1 },
                        subtest2: { score: 1 }
                    }
                }
            }
        }

        const index = 0
        const all = [index]
        const focus_map = {
            test1: all, test2: all, test3: all
        }
        let score = score_run(old_run, new_run, focus_map)
        checkScore(score[index],
            {
                total_tests: 2,
                total_score: 0.5,
                per_mille: 250,
                total_subtests: 6,
                total_subtests_passed: 1,
                per_mille_subtests: 166
            })
        old_run.test_scores.test3.score = 1
        old_run.test_scores.test3.subtests.subtest1.score = 1
        score = score_run(old_run, new_run, focus_map)
        checkScore(score[index],
            {
                total_tests: 2,
                total_score: 1,
                per_mille: 500,
                total_subtests: 6,
                total_subtests_passed: 2,
                per_mille_subtests: 333
            })
    })
})

describe('focus areas', () => {
    it('correctly builds the focus area map for tests', () => {
        const run = {
            test_scores: {
                '/css/CSS2/floats-clear/float-replaced-width-004.xht': {
                    subtests: { sub1: {} }
                },
                '/css/CSS2/abspos/static-inside-table-cell.html': {
                    subtests: {}
                },
                '/css/CSS2/margin-padding-clear/margin-right-078.xht': {
                    subtests: { sub2: {} }
                },
                '/workers/semantics/multiple-workers/001.html': {
                    subtests: {}
                }
            }
        }
        const map = focus_areas_map(run)
        const area_names = get_focus_areas()
        for (const key of Object.keys(map)) {
            map[key] = map[key].map(index => area_names[index])
        }
        assert.deepEqual(map, {
            '/css/CSS2/floats-clear/float-replaced-width-004.xht': [
                'All WPT tests',
                '/css/',
                '/css/CSS2/',
                '/css/CSS2/floats-clear/'
            ],
            '/css/CSS2/abspos/static-inside-table-cell.html': [
                'All WPT tests',
                '/css/',
                '/css/CSS2/',
                '/css/CSS2/abspos/'
            ],
            '/css/CSS2/margin-padding-clear/margin-right-078.xht': [
                'All WPT tests',
                '/css/',
                '/css/CSS2/',
                '/css/CSS2/margin-padding-clear/'
            ],
            '/workers/semantics/multiple-workers/001.html': [
                'All WPT tests'
            ]
        })
    })
})
