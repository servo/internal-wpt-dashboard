import assert from 'node:assert/strict'

function is_object (val) {
    return (
        typeof val === 'object' && val !== null && val !== undefined
    )
}

export function merge_nonoverlap (obj1, obj2) {
    function checkNoArray (obj) {
        for (const [k, v] of Object.entries(obj)) {
            assert(!Array.isArray(v), `Key ${k} - arrays can't be merged`)
            if (is_object(v)) {
                checkNoArray(v)
            }
        }
        return obj
    }

    checkNoArray(obj1)
    const result = obj1
    for (const [k, v] of Object.entries(obj2)) {
        if (is_object(v)) {
            if (result[k] === undefined) {
                result[k] = checkNoArray(v)
            } else {
                assert(is_object(result[k]), `Key ${k} is not an object`)
                result[k] = merge_nonoverlap(obj1[k], v)
            }
        } else {
            assert(!Array.isArray(v), `Key ${k} - arrays can't be merged`)
            assert(!(k in obj1), `Key ${k} overlaps`)
            result[k] = v
        }
    }
    return result
}

export function process_raw_results (raw_results) {
    const test_scores = {}
    const run_info = raw_results.run_info

    for (const test of raw_results.results) {
        const test_name = test.test
        const test_status = test.status

        const test_score = {
            score: test_status === 'PASS' ? 1 : 0,
            subtests: {}
        }

        test_scores[test_name] = test_score

        for (const subtest of test.subtests) {
            test_score.subtests[subtest.name] = {
                score: subtest.status === 'PASS' ? 1 : 0
            }
        }
    }

    return { run_info, test_scores }
}

export function focus_areas_map (run) {
    const map = {}
    for (const test of Object.keys(run.test_scores)) {
        map[test] = []
        for (const [index, area] of FOCUS_AREAS.entries()) {
            if (area.predicate(test)) {
                map[test].push(index)
            }
        }
    }
    return map
}

function regex_predicate (exp) {
    return test_name => exp.test(test_name)
}

function prefix_predicate (prefix) {
    return test_name => test_name.startsWith(prefix)
}

const CSS2_FOCUS_FOLDERS = [
    'abspos',
    'box-display',
    'floats',
    'floats-clear',
    'linebox',
    'margin-padding-clear',
    'normal-flow',
    'positioning'
]

const CSS_TABLES_PREDICATE = /^\/css\/(CSS2\/tables|css-tables)\//

const FOCUS_AREAS = [
    {
        name: 'All WPT tests',
        predicate: prefix_predicate('')
    },
    {
        name: '/content-security-policy',
        predicate: prefix_predicate('/content-security-policy/')
    },
    {
        name: '/css',
        predicate: prefix_predicate('/css/')
    },
    {
        name: '/css/CSS2',
        predicate: prefix_predicate('/css/CSS2/')
    },
    ...CSS2_FOCUS_FOLDERS.map(folder => {
        const path = `/css/CSS2/${folder}/`
        return {
            name: `${path}`,
            predicate: prefix_predicate(path)
        }
    }),
    {
        name: '/css/CSS2/tables & /css/css-tables',
        predicate: regex_predicate(CSS_TABLES_PREDICATE)
    },
    {
        name: '/css/cssom',
        predicate: prefix_predicate('/css/cssom/')
    },
    {
        name: '/css/css-align',
        predicate: prefix_predicate('/css/css-align/')
    },
    {
        name: '/css/css-flexbox',
        predicate: prefix_predicate('/css/css-flexbox/')
    },
    {
        name: '/css/css-grid',
        predicate: prefix_predicate('/css/css-grid/')
    },
    {
        name: '/css/css-position',
        predicate: prefix_predicate('/css/css-position/')
    },
    {
        name: '/css/css-sizing',
        predicate: prefix_predicate('/css/css-sizing/')
    },
    {
        name: '/css/css-text',
        predicate: prefix_predicate('/css/css-text/')
    },
    {
        name: '/gamepad',
        predicate: prefix_predicate('/gamepad/')
    },
    {
        name: '/shadow-dom',
        predicate: prefix_predicate('/shadow-dom/')
    },
    {
        name: '/streams',
        predicate: prefix_predicate('/streams/')
    },
    {
        name: '/trusted-types',
        predicate: prefix_predicate('/trusted-types/')
    },
    {
        name: '/WebCryptoAPI',
        predicate: prefix_predicate('/WebCryptoAPI/')
    },
    {
        name: '/webxr',
        predicate: prefix_predicate('/webxr/')
    }
]

export function get_focus_areas () {
    const area_keys = []
    const area_names = {}
    for (const [key, area] of Object.entries(FOCUS_AREAS)) {
        area_keys.push(key)
        area_names[key] = area.name
    }

    return { area_keys, area_names }
}

export function score_run (run, against_run, focus_areas_map) {
    const scores = FOCUS_AREAS.map(() => ({
        total_tests: 0,
        total_score: 0,
        total_subtests: 0,
        total_subtests_passed: 0
    }))

    for (const [test, { subtests }] of Object.entries(against_run.test_scores)) {
        const area_indices = focus_areas_map[test]
        const subtest_names = Object.keys(subtests)

        for (const index of area_indices) {
            scores[index].total_tests += 1
            scores[index].total_subtests += !subtest_names.length ? 1 : subtest_names.length
        }

        const run_test = run.test_scores[test]

        // score new tests not present in older runs
        if (!run_test) continue

        if (!subtest_names.length) {
            for (const index of area_indices) {
                scores[index].total_score += run_test.score
                scores[index].total_subtests_passed += run_test.score
            }
        } else {
            let subtests_passed = 0
            for (const subtest of subtest_names) {
                if (Object.hasOwn(run_test.subtests, subtest)) {
                    subtests_passed += run_test.subtests[subtest].score
                }
            }
            for (const index of area_indices) {
                scores[index].total_score += subtests_passed / subtest_names.length
                scores[index].total_subtests_passed += subtests_passed
            }
        }
    }

    return scores
}
