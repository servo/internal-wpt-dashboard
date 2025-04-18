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
        for (const [area_key, area] of Object.entries(FOCUS_AREAS)) {
            if (area.predicate(test)) {
                map[test].push(area_key)
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

const FOCUS_AREAS = {
    all: {
        name: 'All WPT tests',
        predicate: prefix_predicate(''),
        order: 0
    },
    csp: {
        name: '/content-security-policy',
        predicate: prefix_predicate('/content-security-policy/'),
        order: 1
    },
    css: {
        name: '/css',
        predicate: prefix_predicate('/css/'),
        order: 2
    },
    css2: {
        name: '/css/CSS2',
        predicate: prefix_predicate('/css/CSS2/'),
        order: 3
    },
    csstable: {
        name: '/css/CSS2/tables & /css/css-tables',
        predicate: regex_predicate(CSS_TABLES_PREDICATE),
        order: 90
    },
    cssom: {
        name: '/css/cssom',
        predicate: prefix_predicate('/css/cssom/'),
        order: 91
    },
    cssalign: {
        name: '/css/css-align',
        predicate: prefix_predicate('/css/css-align/'),
        order: 92
    },
    cssflex: {
        name: '/css/css-flexbox',
        predicate: prefix_predicate('/css/css-flexbox/'),
        order: 93
    },
    cssgrid: {
        name: '/css/css-grid',
        predicate: prefix_predicate('/css/css-grid/'),
        order: 94
    },
    csspos: {
        name: '/css/css-position',
        predicate: prefix_predicate('/css/css-position/'),
        order: 95
    },
    csssizing: {
        name: '/css/css-sizing',
        predicate: prefix_predicate('/css/css-sizing/'),
        order: 95.5
    },
    csstext: {
        name: '/css/css-text',
        predicate: prefix_predicate('/css/css-text/'),
        order: 96
    },
    gamepad: {
        name: '/gamepad',
        predicate: prefix_predicate('/gamepad/'),
        order: 97
    },
    shadowdom: {
        name: '/shadow-dom',
        predicate: prefix_predicate('/shadow-dom/'),
        order: 98
    },
    streams: {
        name: '/streams',
        predicate: prefix_predicate('/streams/'),
        order: 99
    },
    trustedtypes: {
        name: '/trusted-types',
        predicate: prefix_predicate('/trusted-types/'),
        order: 100
    },
    webcryptoapi: {
        name: '/WebCryptoAPI',
        predicate: prefix_predicate('/WebCryptoAPI/'),
        order: 101
    },
    webxr: {
        name: '/webxr',
        predicate: prefix_predicate('/webxr/'),
        order: 102
    }
}

for (const [idx, folder] of CSS2_FOCUS_FOLDERS.entries()) {
    const path = `/css/CSS2/${folder}/`
    FOCUS_AREAS[folder] = {
        name: `${path}`,
        predicate: prefix_predicate(path),
        order: idx + 3
    }
}

export function get_focus_areas () {
    const area_keys = []
    const area_names = {}
    for (const [key, area] of Object.entries(FOCUS_AREAS)) {
        area_keys.push(key)
        area_names[key] = area.name
    }

    area_keys.sort((a, b) => FOCUS_AREAS[a].order - FOCUS_AREAS[b].order)
    return { area_keys, area_names }
}

export function score_run (run, against_run, focus_areas_map) {
    const scores = {}
    for (const area of Object.keys(FOCUS_AREAS)) {
        scores[area] = {
            total_tests: 0,
            total_score: 0,
            total_subtests: 0,
            total_subtests_passed: 0
        }
    }

    for (const [test, { subtests }] of Object.entries(against_run.test_scores)) {
        const areas = focus_areas_map[test]
        const subtest_names = Object.keys(subtests)

        for (const area of areas) {
            scores[area].total_tests += 1
            scores[area].total_subtests += !subtest_names.length ? 1 : subtest_names.length
        }

        const run_test = run.test_scores[test]

        // score new tests not present in older runs
        if (!run_test) continue

        if (!subtest_names.length) {
            for (const area of areas) {
                scores[area].total_score += run_test.score
                scores[area].total_subtests_passed += run_test.score
            }
        } else {
            let subtests_passed = 0
            for (const subtest of subtest_names) {
                if (Object.hasOwn(run_test.subtests, subtest)) {
                    subtests_passed += run_test.subtests[subtest].score
                }
            }
            for (const area of areas) {
                scores[area].total_score += subtests_passed / subtest_names.length
                scores[area].total_subtests_passed += subtests_passed
            }
        }
    }

    return scores
}
