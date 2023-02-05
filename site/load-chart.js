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

function toolTip ([date, score, wpt_sha, servo_version]) {
    const d = parseDateString(date)
    return `
        <b>${formatDate(d)}</b></br>
        Score: <b>${score / 10}</b></br>
        WPT: ${wpt_sha}</br>
        Servo: ${servo_version}
    `
}

function setupChart () {
    const data = new google.visualization.DataTable()
    data.addColumn('date', 'runOn')
    data.addColumn('number', 'Score')
    data.addColumn({ type: 'string', role: 'tooltip', p: { html: true } })

    const endOfYear = new Date(2023, 11, 31)
    let maxDate = new Date()
    if (maxDate > endOfYear) {
        maxDate = endOfYear
    }

    const options = {
        height: 350,
        fontSize: 14,
        hAxis: {
            title: 'Date',
            format: 'dd-MMM-YYYY',
            viewWindow: {
                max: maxDate
            }
        },
        vAxis: {
            title: 'WPT Score',
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
    const chart = new google.visualization.LineChart(node)

    fetchData
        .then(resp => resp.json())
        .then(scores => {
            for (const row of scores.scores) {
                data.addRow([
                    parseDateString(row[0]),
                    row[1] / 1000,
                    toolTip(row)
                ])
            }
            chart.draw(data, options)
        })
}
