const fs = require("fs");
const request = require('request');
const { parse } = require("csv-parse");
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { resolve } = require("path");

const API_KEY = "SmGxgq1pLjeZqyS5C8ooSatWSCH_kXgvVzgPmY0H"
const DOMAIN = "uatchatbot.affinalways.com"
const BOT_ID = "x1665396635536"
const FILE_NAME = 'deleted_utterance'
const CSV_FILE = FILE_NAME + '.csv'
const OUT_CSV = 'zout_' + FILE_NAME + '.csv' 
const getIntentFromprediction = (intentCode) => {
    return new Promise(resolve => {
        const options = {
            'method': 'GET',
            'url': `https://${DOMAIN}/api/ai/v2/intents/?bot=${BOT_ID}&skip=0&limit=50&slugs[]=${intentCode}`,
            'headers': {
                'x-api-key': API_KEY
            }
        };
        request(options, function (error, response) {
            if (error) throw new Error(error);
            let body = JSON.parse(response.body)
            // console.log(response.body);
            let { data } = body;
            if (data.length) {
                const { name } = data[0]
                return resolve(name)
            }
            resolve(intentCode)
        });
    })
}
const passIntent = (intents) => {
    return new Promise(async resolve => {
        let object = {}
        for (const [key, value] of Object.entries(intents)) {
            // console.log(`${key}: ${value}`);
            const intentName = await getIntentFromprediction(key);
            object[intentName] = value;
        }
        return resolve(object)
    })
}
const getPrediction = (utterance) => {
    return new Promise(resolve => {
        const options = {
            'method': 'POST',
            'url': `https://${DOMAIN}/api/ai/prediction?bot=${BOT_ID}`,
            'headers': {
                'x-api-key': API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "language": "en",
                "text": utterance
            })

        };
        request(options, function (error, response) {
            if (error) throw new Error(error);
            let body = JSON.parse(response.body)
            let { intents } = body.data
            // console.log({ intents, utterance }, "intents in response");
            if (!Object.keys(intents).length) {
                const { intent, confidence } = body.data
                let object = {}
                object[intent] = confidence;
                resolve(object);
            }
            resolve(intents)
        });
    })
}

let arrayForUpload = []

const readable = fs.createReadStream(`./${CSV_FILE}`)
    .pipe(parse({ delimiter: ",", from_line: 2 }))

readable.on("data", async function (row) {
    readable.pause()
    console.log(row[0], "row");
    const utterance = row[0]
    const getPredictionResponse = await getPrediction(utterance);
    const actualIntentWithConfidence = await passIntent(getPredictionResponse)
    console.log({ actualIntentWithConfidence, utterance }, "actualIntentWithConfidence")
    let text = ''
    for (const [key, value] of Object.entries(actualIntentWithConfidence)) {
        text = text + key + ': ' + value + '\n'
    }
    let object = {
        'Utterance': utterance,
        'Intents': text
    }
    arrayForUpload.push(object)
    readable.resume();
})
    .on('end', () => {
        const csvWriter = createCsvWriter({
            path: OUT_CSV,
            header: [
                { id: 'Utterance', title: 'Utterance' },
                { id: 'Intents', title: 'Intents' }
            ]
        });
        console.log(arrayForUpload, "arrayForUpload")
        csvWriter
            .writeRecords(arrayForUpload)
            .then(() => console.log('The CSV file was written successfully'));
        console.log('\n-----CSV file successfully processed-------\n');
    });
