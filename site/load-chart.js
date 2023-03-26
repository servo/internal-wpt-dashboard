/* global google */

google.charts.load('current', { packages: ['corechart', 'line'] })
google.charts.setOnLoadCallback(setupChart)

const fetchData = fetch('scores.json')

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
        Servo (w/ layout ${engine}): ${servo_version}
    `
}

function setupChart () {
    const endOfYear = new Date(2023, 11, 31)
    let maxDate = new Date()
    if (maxDate > endOfYear) {
        maxDate = endOfYear
    }

    const options = {
        height: 350,
        fontSize: 16,
        legend: { position: 'top' },
        hAxis: {
            format: 'MMM-YYYY',
            viewWindow: {
                max: maxDate
            }
        },
        vAxis: {
            format: 'percent',
            viewWindow: {
                min: 0,
                max: 1
            }
        },
        explorer: {
            actions: ['dragToZoom', 'rightClickToReset'],
            axis: 'horizontal',
            keepInBounds: true,
            maxZoomIn: 4.0
        },
        tooltip: {
            isHtml: true,
            trigger: 'both'
        }
    }

    const node = document.getElementById('servo-chart')
    const area_dropdown = document.getElementById('selected-area')
    const chart = new google.visualization.LineChart(node)
    let all_scores

    function update_chart () {
        if (!all_scores) throw new Error('scores not loaded')
        const chosen_area = area_dropdown.value
        const area_index = all_scores.area_keys.indexOf(chosen_area)
        const table = new google.visualization.DataTable()
        const stride = all_scores.area_keys.length
        table.addColumn('date', 'runOn')
        table.addColumn('number', 'Layout 2013')
        table.addColumn({ type: 'string', role: 'tooltip', p: { html: true } })
        table.addColumn('number', 'Layout 2020')
        table.addColumn({ type: 'string', role: 'tooltip', p: { html: true } })
        for (const s of all_scores.scores) {
            const score_2013 = s[area_index + 3]
            const score_2020 = s[stride + area_index + 5]
            const date = parseDateString(s[0])
            const row = [
                date,
                score_2013 / 1000,
                toolTip(date, s[1], s[2], score_2013, '2013')
            ]
            if (score_2020 !== undefined) {
                const wpt_sha = s[stride + 3]
                const version = s[stride + 4]
                row.push(
                    score_2020 / 1000,
                    toolTip(date, wpt_sha, version, score_2020, '2020')
                )
            } else {
                row.push(undefined, undefined)
            }
            table.addRow(row)
        }
        chart.draw(table, options)
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
            const score_table = document.getElementById('score-table-body')
            for (const [idx, area] of scores.area_keys.entries()) {
                const selector = document.createElement('option')
                selector.value = area
                selector.textContent = scores.focus_areas[area]
                area_dropdown.appendChild(selector)

                const recent_score = scores.scores[scores.scores.length - 1]
                const stride = scores.area_keys.length
                score_table.insertAdjacentHTML(
                    'beforeend',
                    `<tr class="${idx % 2 ? 'odd' : 'even'}">
                        <td>${selector.textContent}</td>
                        <td class="score">${String(recent_score[idx + 3] / 10).padEnd(4, '.0')}%</td>
                        <td class="score">${String(recent_score[stride + idx + 5] / 10).padEnd(4, '.0')}%</td>
                    </tr>`
                )
            }
            area_dropdown.onchange = update_chart
            area_dropdown.value = scores.area_keys[0]
            update_chart()
        })
}
