var Google = require('googleapis');
var Moment = require('moment-timezone');
var Async = require('async');
var _ = require('underscore');

exports.listMessages = listMessages;

var mail = Google.gmail('v1');

/**
 * Lists messages based of the given parameters
 */
function listMessages(callback, auth, count, startDate, endDate, verbose) {
    var mailArgs = {
        auth: auth,
        userId: 'me'
    };
    mailArgs['maxResults'] = count || 10;
    var afterDate = Moment.tz(startDate, 'Europe/Zurich') || Moment().tz('Europe/Zurich');
    mailArgs['q'] = 'after:' + afterDate.subtract(1, 'd').endOf('day').format('X');

    if (endDate) {
        mailArgs['q'] += ' AND before:' + Moment.tz(endDate, 'Europe/Zurich').add(1, 'd').startOf('day').format('X');
    }

    mail.users.messages.list(
        mailArgs,
        function(err, response) {
            if (err) {
                callback('The Google Mail API returned an error: ' + err);
                return;
            }
            if (verbose) {
                console.log("Fetching mails:");
                process.stdout.write('[');
            }
            Async.mapLimit(
                response.messages,
                5,
                function(msg, callback) {
                    if (verbose) {
                        process.stdout.write("=");
                    }
                    return handleMessage(auth, msg, callback);
                },
                function(err, results) {
                    if (verbose) {
                        process.stdout.write("]\n");
                    }
                    callback(err, results.reverse());
                }
            );
        }
    );
}

function handleMessage(auth, msg, callback) {
    mail.users.messages.get({
        auth: auth,
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject']
    }, function (err, response) {
        if (err) {
            callback('The Google Mail API returned an error: ' + err);
            return;
        }
        var msgDate = Moment(response.internalDate, 'x').tz('Europe/Zurich');
        var subject = _.find(response.payload.headers, function(header) {
            return header.name === 'Subject';
        }).value;
        if (subject.length > 80) {
            subject = subject.substring(0,80).trim() + '...';
        }

        var from = _.find(response.payload.headers, function(header) {
            return header.name === 'From';
        }).value;

        var msg = {
            'project': 'xxx',
            'time': msgDate.format('HH:mm'),
            'text': subject + ' (From: ' + from + ')',
            'timestamp': msgDate.startOf('day').format('X'),
            'type': 'mail',
            'comment': false
        };

        callback(null, msg);
    });
}
