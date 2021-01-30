const { MongoClient } = require("mongodb")
const { LoremIpsum } = require('lorem-ipsum')
const { performance } = require('perf_hooks')

const client = new MongoClient("mongodb://localhost:27017/", { useUnifiedTopology: true })

async function run(action) {
    try {
        await client.connect();
        const db = client.db("usersdb");
        const collection = db.collection("users");
        await action(collection)
    } catch (err) {
        console.error(err)
    } finally {
        await client.close();
    }
}

async function addUser(collection) {
    const args = process.argv.slice(3)
    if (args.length < 5)
        throw new Error('too few arguments')

    const fullName = args.slice(0, 3).map(str => str[0].toUpperCase() + str.slice(1).toLowerCase()).join(' ')

    if (new Date(args[3].split('.').reverse().join('-')) == 'Invalid Date')
        throw new Error('Wrong format of bithday - DD.MM.YYYY')

    const birthday = args[3].split('.').map(i => i.padStart(2, '0')).join('.')
    const gender = args[4][0].toUpperCase()

    if (gender != 'M' && gender != 'W')
        throw new Error('Wrong formate ogender - Man(M) or Woman(W)')

    await collection.insertOne({ fullName, birthday, gender })

}

async function getUsers(collection) {
    const find = await collection.aggregate([
        { $group: { _id: ['$fullName', '$birthday'], gender: { $first: '$gender' } }, },
        { $sort: { '_id.0': 1 } },
        { $limit: 100 },
    ], { allowDiskUse: true })
    await find
        .map(({ _id, gender }) =>
            _id.join(' ')
                .concat(' ' + gender)
                .concat(' ' + new Date(new Date() - new Date(_id[1].split('.').reverse().join('-')) - - new Date('0000-01-01')).getFullYear())
        )
        .forEach(console.log)
}


async function generateUsers(collection) {
    const lorem = new LoremIpsum()
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const randomNumber = (max = 1, min = 0) => min + Math.round(Math.random() * (max - min))
    const generateWord = (startsWith = alphabet[Math.round(Math.random() * (alphabet.length - 1))]) => startsWith + lorem.generateWords(1)
    const generateBirthday = () => [
        randomNumber(28, 1).toString().padStart(2, '0'),
        randomNumber(12, 1).toString().padStart(2, '0'),
        randomNumber(2002, 1950).toString().padStart(2, '0'),
    ].join('.')

    const users = []
    for (let i = 0; i < 1000000; i++) {
        users.push({
            fullName: Array(3).fill(0).map(_ => generateWord()).join(' '),
            birthday: generateBirthday(),
            gender: Math.random() > 0.5 ? 'M' : 'W'
        })
    }

    for (let i = 0; i < 100; i++) {
        users.push({
            fullName: Array(3).fill(0).map(_ => generateWord('F')).join(' '),
            birthday: generateBirthday(),
            gender: 'M'
        })
    }

    await collection.insertMany(users)
}


async function findFFF(collection) {
    const start = performance.now()
    await collection.find({ fullName: { $regex: /^(F\w*\s?){3}$/ } }).explain()
    console.log(performance.now() - start)
}


switch (Number(process.argv[2])) {
    case 1:
        console.log('creage db')
        break;
    case 2:
        run(addUser)
        break;
    case 3:
        run(getUsers)
        break
    case 4:
        run(generateUsers)
        break
    case 5:
        run(findFFF)
        break
    default:
        console.log(`
            1: create table
            2: add an user
            3: get all users
            4: generate many users
            5: find triple F
        `)
        break;
}

