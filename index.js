import { mkdir, opendir, readFile, writeFile } from 'node:fs/promises'
import { compress, decompress } from 'lzma-native'
import {
    merge_nonoverlap,
    process_raw_results,
    score_run,
    focus_areas_map,
    get_focus_areas
} from './process-wpt-results.js'

async function read_json_file (path) {
    const contents = await readFile(path, {
        encoding: 'utf8'
    })
    return JSON.parse(contents)
}

async function write_json_file (path, json) {
    const contents = JSON.stringify(json)
    return writeFile(path, contents)
}

async function write_compressed (path, json) {
    const string = JSON.stringify(json)
    const data = await compress(string, 9)
    return writeFile(path, data)
}

async function read_compressed (path) {
    const data = await readFile(path)
    const string = await decompress(data)
    return JSON.parse(string)
}

async function all_runs_sorted (runs_dir) {
    const dir = await opendir(`./${runs_dir}`)
    const runs = []
    for await (const run of dir) {
        if (run.name === '.DS_Store') continue
        runs.push(run.name)
    }

    runs.sort()
    return runs
}

async function process_chunks (path) {
    const dir = await opendir(path)
    let result = {}
    for await (const chunk of dir) {
        if (chunk.name === '.DS_Store') continue
        console.log(`Processing chunk ${chunk.name}`)
        const chunk_run = await read_json_file(`${path}/${chunk.name}`)
        const scored_chunk = process_raw_results(chunk_run)
        if (!result.run_info) {
            const raw_run_info = scored_chunk.run_info
            const matches = raw_run_info
                .browser_version.match(/^Servo ([0-9.]+-[a-f0-9]+)?(-dirty)?$/)
            const browser_version = matches.length === 3 ? matches[1] : 'Unknown'
            result.run_info = Object.assign(raw_run_info, { browser_version })
        }
        delete scored_chunk.run_info
        result = merge_nonoverlap(result, scored_chunk)
    }

    sort_test_results(result)

    return result
}

// Sorts the keys of the test_scores object alphabetically
function sort_test_results (result) {
    console.log('Sorting results')
    result.test_scores = into_sorted_map(result.test_scores)
}

// Convert an object into a sorted Map
//
// JS Maps serialize keys in insertion order, so to control the order of JSON serialized output
// we can:
//
// - Convert the object into an array
// - Sort the array by test object key
// - Reinsert the results into a new Map in order
//
// Storing the result in a Map rather a regular object allows us to have full control over the order
function into_sorted_map (obj) {
    const arr = Object.entries(obj).map(([key, value]) => ({ key, value }))
    arr.sort((a, b) => {
        if (a.key < b.key) return -1
        if (a.key > b.key) return 1
        return 0
    })

    const map = new Map()
    for (const entry of arr) {
        map[entry.key] = entry.value
    }

    return map
}

async function add_run (runs_dir, chunks_dir, date) {
    const new_run = await process_chunks(chunks_dir)
    await write_compressed(`./${runs_dir}/${date}.xz`, new_run)
}

async function recalc_scores (runs_dir) {
    console.log(`Calculating scores for ${runs_dir} directory...`)

    const run_results = []
    console.log('Enumerating runs')
    const all_runs = await all_runs_sorted(runs_dir)
    const run_count = all_runs.length
    console.log('Reading latest run')
    const new_run = await read_compressed(`./${runs_dir}/${all_runs[all_runs.length - 1]}`)
    console.log('Building focus area map')
    const test_to_areas = focus_areas_map(new_run)
    for (const [i, r] of all_runs.entries()) {
        const [date] = r.split('.')
        console.log(`Reading run ${runs_dir}/${r} (${i}/${run_count})`)
        const run = await read_compressed(`./${runs_dir}/${r}`)
        console.log(`Calculating score for run ${runs_dir}/${r} (${i}/${run_count})`)
        const score = score_run(run, new_run, test_to_areas)
        const row = {
            date,
            wpt_revision: run.run_info.revision.substring(0, 9),
            product_revision: run.run_info.browser_version,
            scores: score
        }

        run_results.push(row)
    }

    return run_results
}

async function main () {
    const mode = process.argv[2]
    if (!['--add', '--recalc'].includes(mode)) {
        throw new Error(`invalid mode specified: ${mode}`)
    }

    if (mode === '--add') {
        const chunks = process.argv[3]
        const date = process.argv[4]
        await add_run('runs-2020', chunks, date)
    }

    const run_results = await recalc_scores('runs-2020')
    const last_run = run_results[run_results.length - 1]

    const focus_areas = get_focus_areas()

    console.log('Writing site/scores.json')
    await mkdir('./site', { recursive: true })
    write_json_file(
        './site/scores.json', { focus_areas, runs: run_results })
    console.log('Writing site/scores-last-run.json')
    write_json_file(
        './site/scores-last-run.json', { focus_areas, last_run })

    console.log('Done')
}
main()
