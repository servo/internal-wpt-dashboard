/* global google */

google.charts.load('current', { packages: ['corechart', 'line'] })
google.charts.setOnLoadCallback(setupChart)

const fetchData = fetch('scores.json')
const embed = location.search === '?embed'

const dateRanges = {
    'last month': 1,
    'last 3 months': 3,
    'last 6 months': 6,
    'last year': 12,
    'all data': null
}

if (embed) {
    document.documentElement.classList.add('embed')
}

function formatDate (date) {
    const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ]
    const year = date.getFullYear()
    const month = months[date.getMonth()]
    const day = date.getDate()
    return `${month} ${day}, ${year}`
}

function parseDateString (date) {
    const [y, m, d] = date.split('-')
    return new Date(y, m - 1, d)
}

function toolTip (date, wpt_sha, servo_version, score, engine) {
    return `
        <b>${formatDate(date)}</b></br>
        Score: <b>${score / 10}</b></br>
        WPT: ${wpt_sha}</br>
        Servo (${engine}): ${servo_version}
    `
}

function setupChart () {
    const endOfYear = new Date(2024, 11, 31)
    let maxDate = new Date()
    if (maxDate > endOfYear) {
        maxDate = endOfYear
    }

    const options = {
        height: 350,
        fontSize: 16,
        legend: {
            position: 'top',
            ...(embed
                ? {
                    textStyle: { color: '#f5f5f5' }
                }
                : {})
        },
        hAxis: {
            format: 'MMM-YYYY',
            viewWindow: {
                max: maxDate
            },
            ...(embed
                ? {
                    textStyle: { color: '#f5f5f5' }
                }
                : {})
        },
        vAxis: {
            format: 'percent',
            viewWindow: {
                min: 0,
                max: 1
            },
            ...(embed
                ? {
                    textStyle: { color: '#f5f5f5' }
                }
                : {})
        },
        explorer: {
            actions: ['dragToZoom', 'rightClickToReset'],
            axis: 'horizontal',
            keepInBounds: true,
            maxZoomIn: 4.0
        },
        tooltip: {
            // textStyle has no effect if isHtml is true
            isHtml: true,
            trigger: 'both'
        },
        ...(embed
            ? {
                backgroundColor: '#121619'
            }
            : {})
    }

    const node = document.getElementById('servo-chart')
    const test_area_dropdown = document.getElementById('test-selected-area')
    const date_area_dropdown = document.getElementById('date-selected-area')
    const show_legacy = document.getElementById('show-legacy')
    const chart = new google.visualization.LineChart(node)
    let all_scores

    Object.keys(dateRanges).forEach(date => {
        const selector = document.createElement('option')
        selector.value = date
        selector.textContent = date
        date_area_dropdown.appendChild(selector)
    })

    function update_chart () {
        if (!all_scores) throw new Error('scores not loaded')
        const chosen_area = test_area_dropdown.value
        const chosen_date = date_area_dropdown.value
        const area_index = all_scores.area_keys.indexOf(chosen_area)
        const table = new google.visualization.DataTable()
        const stride = all_scores.area_keys.length
        const legacy_layout = show_legacy.checked
        options.series = []

        table.addColumn('date', 'runOn')

        if (legacy_layout) {
            options.series.push({ color: '#DC3912' })
            table.addColumn('number', 'Legacy Layout')
            table.addColumn({ type: 'string', role: 'tooltip', p: { html: true } })
        }

        options.series.push({ color: '#3366CC' })
        table.addColumn('number', 'Servo Layout')
        table.addColumn({ type: 'string', role: 'tooltip', p: { html: true } })

        for (const s of all_scores.scores) {
            const score_2013 = s[area_index + 3]
            const score_2020 = s[stride + area_index + 5]
            const date = parseDateString(s[0])
            const monthsToSubtract = dateRanges[chosen_date]
            if (monthsToSubtract && date < new Date(maxDate.getFullYear(), maxDate.getMonth() - monthsToSubtract, 1)) {
                continue
            }
            const row = [
                date
            ]

            if (legacy_layout) {
                row.push(
                    score_2013 / 1000,
                    toolTip(date, s[1], s[2], score_2013, 'Legacy Layout')
                )
            }

            if (score_2020 !== undefined) {
                const wpt_sha = s[stride + 3]
                const version = s[stride + 4]
                row.push(
                    score_2020 / 1000,
                    toolTip(date, wpt_sha, version, score_2020, 'Servo Layout')
                )
            } else {
                row.push(undefined, undefined)
            }
            table.addRow(row)
        }
        chart.draw(table, options)
    }

    function removeChildren (parent) {
        while (parent.firstChild) {
            parent.removeChild(parent.firstChild)
        }
        return parent
    }

    function update_table (scores) {
        const score_table = document.getElementById('score-table-body')
        const legacy = (value) => show_legacy.checked ? value : ''
        removeChildren(score_table)

        removeChildren(document.getElementById('score-table-header'))
            .insertAdjacentHTML(
                'beforeend',
                `<tr>
                    <th>Test Suite</th>
                    ${legacy('<th>Legacy Layout</th>')}
                    <th>Servo Layout</th>
                </tr>`
            )

        for (const [idx, area] of scores.area_keys.entries()) {
            const recent_score = scores.scores[scores.scores.length - 1]
            const stride = scores.area_keys.length
            score_table.insertAdjacentHTML(
                'beforeend',
                `<tr class="${idx % 2 ? 'odd' : 'even'}">
                    <td>${scores.focus_areas[area]}</td>
                    ${legacy(`<td class="score">${String(recent_score[idx + 3] / 10).padEnd(4, '.0')}%</td>`)}
                    <td class="score">${String(recent_score[stride + idx + 5] / 10).padEnd(4, '.0')}%</td>
                </tr>`
            )
        }
    }

    fetchData
        .then(resp => resp.json())
        .then(scores => {
            all_scores = scores
            if (scores.scores.length < 60) {
                options.hAxis.format = 'dd MMM YYYY'
            } else {
                options.hAxis.format = 'MMM YYYY'
            }

            for (const area of scores.area_keys) {
                const selector = document.createElement('option')
                selector.value = area
                selector.textContent = scores.focus_areas[area]
                test_area_dropdown.appendChild(selector)
            }

            function update () {
                update_table(scores)
                update_chart()
            }

            test_area_dropdown.onchange = update
            date_area_dropdown.onchange = update
            show_legacy.onchange = update
            test_area_dropdown.value = scores.area_keys[1]
            date_area_dropdown.value = Object.keys(dateRanges)[4]
            update()
        })
}
