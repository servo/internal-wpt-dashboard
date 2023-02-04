import { opendir, readFile, writeFile } from 'node:fs/promises'
import { process_raw_results, score_run } from './process-wpt-results.js'

async function readJsonFile(path) {
  const contents = await readFile(path, {
    encoding: 'utf8'
  })
  return JSON.parse(contents)
}

async function writeJsonFile(path, json) {
  const contents = JSON.stringify(json)
  return writeFile(path, contents)
}

async function main() {
  const filename = process.argv[2];
  const date = process.argv[3];
  const results = await readJsonFile(filename)
  const new_run = process_raw_results(results)
  await writeJsonFile(`./runs/${date}.json`, new_run)


  const scores = [];
  const dirs = await opendir('./runs') ;
  for await (const dir of dirs) {
    const [date, ] = dir.name.split('.')
    const run = await readJsonFile(`./runs/${dir.name}`)
    const score = score_run(run, new_run)
    scores.push([date, score, run.run_info.revision.substring(0, 6)])
  }

  writeJsonFile('./site/scores.json', { scores })
}

main()
