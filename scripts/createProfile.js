var PersonalityInsightsV3 = require('watson-developer-cloud/personality-insights/v3');
var Twitter = require('twitter');
var fs = require('fs');
var request = require('request');


//Variables
var text = "";
var ID = "default";

//Keys for authentication
var Credentials = fs.readFileSync('./Keys.json', 'utf-8');
var ParsedCredentials = JSON.parse(Credentials);

//Authentication into Twitter
var client = new Twitter
({
    consumer_key: ParsedCredentials.twitter[0].consumer_key,
    consumer_secret: ParsedCredentials.twitter[0].consumer_secret,
    access_token_key: ParsedCredentials.twitter[0].access_token_key,
    access_token_secret: ParsedCredentials.twitter[0].access_token_secret
});

//Authentication into the Personality Insight API
var personalityInsights = new PersonalityInsightsV3
({
    version: ParsedCredentials.ibm[0].version,
    iam_apikey: ParsedCredentials.ibm[0].iam_apikey,
    url: ParsedCredentials.ibm[0].url,
});

module.exports = 
{
    add: function(input, callback)
    {
        //USERNAME
        ID = input;

        //If there isn't a folder for this user yet then create one
        if (!fs.existsSync('./users/' + ID))
        {
            fs.mkdirSync('./users/' + ID);
        }

        getImages(function(e){console.log("Got all pictures")});
    
        getTweets(function()
        {
            getBig5(function(data)
            {
                if(data)
                {
                    console.log("Created big 5");
                    callback(1);
                }
                else
                {
                    callback(0);
                }
            })
        }) 
    }
}

function getImages(callback)
{
    var downloadStatus = [0,0,0,0,0];

    client.get('users/show', {screen_name: ID}, function(error, response)
    {
        console.log("Downloading...");

        var banner = response["profile_banner_url"];
        var smallSize = response["profile_image_url"];
        var originalSize = smallSize.slice(0,smallSize.length-11) + ".jpg";
        var biggerSize = smallSize.slice(0,smallSize.length-11) + "_bigger.jpg";
        var miniSize = smallSize.slice(0,smallSize.length-11) + "_mini.jpg";

        download(originalSize, './users/' + ID + '/originalProfilePic.jpg', function()
        {
            downloadStatus[0] = 1;
        })
        download(smallSize, './users/' + ID + '/smallProfilePic.jpg', function()
        {
            downloadStatus[1] = 1;
        })
        download(biggerSize, './users/' + ID + '/biggerProfilePic.jpg', function()
        {
            downloadStatus[2] = 1;
        })
        download(miniSize, './users/' + ID + '/miniProfilePic.jpg', function()
        {
            downloadStatus[3] = 1;
        })
        download(banner, './users/' + ID + '/bannerPic.jpg', function()
        {
            downloadStatus[4] = 1;
        })

        setTimeout(function()
        {
            if(downloadStatus[0] == 1 && downloadStatus[1] == 1 && downloadStatus[2] == 1 && downloadStatus[3] == 1 && downloadStatus[4] == 1)
            {
                console.log("Downloaded all pictures");
                callback();
            }
            else
            {
                console.log("Failed to download");
                callback();
            }
        },1000)
    });
}

function getTweets(callback)
{
    //Get tweets from user timeline
    client.get('statuses/user_timeline', {screen_name: ID, count: '1000', include_rts: 'false'}, function(error, response)
    {
        var outputText = "";

            /*Locations
            if(tweets[i].place)
            {
                console.log("ID -> " + i + " | " + tweets[i].place.bounding_bo
                x.coordinates);
            }
            */

        //Make them json
        var data = JSON.stringify(response, null, 2);

        //Clean them
        var profileText = JSON.parse(data);
        outputText += "{ \"contentItems\" : [\n\n";

        var times = [];

        //Take tweet text
        for(var i = 0; i < profileText.length;   i++)
        {
            times.push(profileText[i].created_at.split(" "));

            text =  profileText[i].text;
            text = text.replace(/(\r\n|\n|\r)/gm," ");
            text = text.replace(/"/g, '');
            
            var parsedUnixTime = new Date(profileText[i].created_at).getUnixTime();
            outputText += "{\n\t\"content\":\"" + text + "\",\n\t\"contenttype\": \"text/plain\",\n\t\"created\":" + parsedUnixTime + ",\n\t\"id\":\"" + profileText[i].id + "\",\n\t\"language\":\"en\"\n}";
            
            if((i+1) != profileText.length)
            {
                outputText += ",\n";
            }
        }

        fs.writeFileSync('./users/' + ID + '/times.json', JSON.stringify(times));
        outputText += "]}";
        fs.writeFileSync('./users/' + ID + '/profile.json', outputText);

        setTimeout(function()
        {
            if(fs.existsSync('./users/' + ID + '/times.json') && fs.existsSync('./users/' + ID + '/profile.json'))
            {
                callback(1);
            }
            else
            {
                callback(0);
            }
        },50)
    });
}

function getBig5(callback)
{
    //Prepare a request for the watson ai
    var profileParams = {

        // Get the content from the JSON file.
        content: require('../users/' + ID + '/profile.json'),
        content_type: 'application/json',
        consumption_preferences: 'true'
    };

    //Gets the information from the Personality Insight tool belonging to the Watson AI
    personalityInsights.profile(profileParams, function(error, profile) 
    {
        if (error) //If there's an error we delete the whole account
        {
            console.log("FAILED! Error code - " + error.code);
            callback(0);
        } 
        else //If everything works out well we take the big 5 traits and adjust them from 0-1 to 1-20
        { 
            console.log(ID);
            fs.writeFileSync('./users/' + ID + '/watsonOutputRaw.json', JSON.stringify(profile, null, 2));
            callback(1);
        }
    });
}

function download(uri, filename, callback)
{
    request.head(uri, function(err, res, body)
    {
        request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
    });
};

//Getting dates
Date.prototype.getUnixTime = function() {return this.getTime()/1000|0};
if(!Date.now) Date.now = function() { return new Date(); }
Date.time = function() { return Date.now().getUnixTime(); }