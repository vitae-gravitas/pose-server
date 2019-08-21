require('@tensorflow/tfjs-node-gpu');
const posenet = require('@tensorflow-models/posenet');
const ffmpeg = require('ffmpeg');
const ffmpeg2 = require('fluent-ffmpeg');
const fs = require('fs');
const _ = require('lodash');
const {createCanvas, loadImage} = require('canvas');

var admin = require("firebase-admin");
var serviceAccount = require("./vitae-gravitas-firebase-adminsdk-hp87l-0c32b80f4d.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "vitae-gravitas.appspot.com"
});
var bucket = admin.storage().bucket();
var net = null;

async function loadNet() {
    net = await posenet.load({
        architecture: 'ResNet50',
        outputStride: 32,
        inputResolution: 161,
        quantBytes: 1
    });
}

async function analyze(imageLocation) {
    console.log("test1")
    if (net == null) {
        console.log("loading net for the first time")
        await loadNet()
    } else {
        console.log("net already loaded")
    }
    
    // const vid = await new ffmpeg(vidLocation);
    // const skip = 3;
    // const frames = await vid.fnExtractFrameToJPG('./frames', {
    //     every_n_frames: skip,
    // });
    const lines = [
        ["leftShoulder", "leftElbow"],
        ["leftElbow", "leftWrist"],
        ["rightShoulder", "rightElbow"],
        ["rightElbow", "rightWrist"],
        ["leftShoulder", "leftHip"],
        ["rightShoulder", "rightHip"],
        ["leftShoulder", "rightShoulder"],
        ["leftHip", "rightHip"],
        ["leftHip", "leftKnee"],
        ["leftKnee", "leftAnkle"],
        ["rightHip", "rightKnee"],
        ["rightKnee", "rightAnkle"],
    ];
    console.log("test2")
    const image = await loadImage(imageLocation);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const pose = await net.estimateSinglePose(ctx.canvas);
    console.log("test3")
    pose.keypoints.forEach(keypoint => {
        const {position: {x, y}} = keypoint;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI, false);
        ctx.fillStyle = 'black';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.stroke();
    });

    const pointsByPart = _.keyBy(pose.keypoints, "part");
    const parts = Object.keys(pointsByPart);

    lines.forEach(([a, b]) => {
        if (parts.includes(a) && parts.includes(b)) {
            const {position: {x: x1, y: y1}} = pointsByPart[a];
            const {position: {x: x2, y: y2}} = pointsByPart[b];
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(0,0,0,1)';
            ctx.lineTo(x2, y2);
            ctx.stroke();

        }
    })
    console.log("test4")
    const leftDepthConfidence = pointsByPart['leftKnee']['score'] + pointsByPart['leftHip']['score']
    const rightDepthConfidence = pointsByPart['rightKnee']['score'] + pointsByPart['rightHip']['score']
    var didHitDepth = false
    if (leftDepthConfidence > rightDepthConfidence) {
        didHitDepth = pointsByPart['leftKnee']['position']['y'] < pointsByPart['leftHip']['position']['y'] 
    } else {
        didHitDepth = pointsByPart['rightKnee']['position']['y'] < pointsByPart['rightHip']['position']['y']
    }

    console.log(didHitDepth)

    var buf = canvas.toBuffer();
    // return buf
    // fs.writeFileSync("test.png", buf);

    return buf     
}

async function analyzeImage (inputLocationInDB, outputLocationInDB) {
    bucket.file(inputLocationInDB).download(function(err, contents) {
        console.log(inputLocationInDB + " was downloaded")
        analyze(contents).then(result => {
            console.log(inputLocationInDB + " was analyzed")
            const file = bucket.file(outputLocationInDB);
            file.save(result, function(err) {
                if (!err) {
                    // File written successfully.
                    console.log("result was saved to db")
                }
            });
        });
    });
}

var analyzeListOfImages = async function(requestBody) {
    console.log("running list images method")
    for (var i = 0; i < requestBody.imageLocations.length; i++) {
        console.log("analyzing " + requestBody.imageLocations[i])
        analyzeImage(requestBody.imageLocations[i], requestBody.outputLocations[i])
    }
}

module.exports = analyzeListOfImages;

// analyzeImage('poseImages/test/rep-1.jpg', 'analyzed-poseImages/test/adsfadsfasdf.jpg')