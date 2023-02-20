import { opendir, readFile, writeFile } from 'node:fs/promises'
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

async function all_runs_sorted () {
    const dir = await opendir('./runs')
    const runs = []
    for await (const run of dir) {
        runs.push(run.name)
    }

    runs.sort()
    return runs
}

async function process_chunks (path) {
    const dir = await opendir(path)
    let result = {}
    for await (const chunk of dir) {
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
    return result
}

async function main () {
    const mode = process.argv[2]
    if (!['--add', '--recalc'].includes(mode)) {
        throw new Error(`invalid mode specified: ${mode}`)
    }

    let new_run
    if (mode === '--add') {
        const chunks_path = process.argv[3]
        const date = process.argv[4]

        new_run = await process_chunks(chunks_path)
        await write_compressed(`./runs/${date}.xz`, new_run)
    } else if (mode === '--recalc') {
        const all_runs = await all_runs_sorted()
        new_run = await read_compressed(`./runs/${all_runs[all_runs.length - 1]}`)
    }

    const scores = []
    const runs = await all_runs_sorted()
    const test_to_areas = focus_areas_map(new_run)
    const { area_keys, area_names: focus_areas } = get_focus_areas()
    for (const r of runs) {
        const [date] = r.split('.')
        const run = await read_compressed(`./runs/${r}`)
        const score = score_run(run, new_run, test_to_areas)
        const row = [
            date,
            run.run_info.revision.substring(0, 6),
            run.run_info.browser_version
        ]

        for (const area of area_keys) {
            row.push(score[area])
        }
        scores.push(row)
    }

    write_json_file('./site/scores.json', { area_keys, focus_areas, scores })
}
main()
