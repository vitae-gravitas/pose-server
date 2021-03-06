require('@tensorflow/tfjs-node');
const posenet = require('@tensorflow-models/posenet');
const bodyPix = require('@tensorflow-models/body-pix');
const cocoSsd = require('@tensorflow-models/coco-ssd');
const ffmpeg = require('ffmpeg');
const ffmpeg2 = require('fluent-ffmpeg');
const fs = require('fs');
const _ = require('lodash');
const {createCanvas, loadImage} = require('canvas');
var admin = require("firebase-admin");
var serviceAccount = require("./vitae-gravitas-firebase-adminsdk-hp87l-0c32b80f4d.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "vitae-gravitas.appspot.com",
    databaseURL: "https://vitae-gravitas.firebaseio.com"
});
var bucket = admin.storage().bucket();
var db = admin.database();

var jointnet = null;
var humandetectionModel = null;
var bodySegmentation = null;

var hitDepthArray = []

async function loadNet() {
    
//    [jointnet, humandetectionModel] = await Promise.all([posenet.load({
//        architecture: 'ResNet50',
//        outputStride: 16,
//        inputResolution: 801,
//        quantBytes: 4
//    }), cocoSsd.load()]);
    jointnet = await posenet.load({
        architecture: 'ResNet50',
        outputStride: 16,
        inputResolution: 801,
        quantBytes: 4
    });

    humandetectionModel = await cocoSsd.load();
    
    bodySegmentation = await bodyPix.load(1.0);
}

async function analyze(imageLocation) {
    console.log("test1")
    if (jointnet == null) {
        console.log("loading net for the first time")
        await loadNet()
        console.log("finished loading net for the first time")
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
    console.log("image is about to be loaded")
    const image = await loadImage(imageLocation);
    var orginalCanvas = createCanvas(image.width, image.height);
    var ctx = orginalCanvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    console.log("image will have predictions run through the net")
    const boundingboxes = await humandetectionModel.detect(ctx.canvas)
    console.log(boundingboxes)
    boundingboxes.some(function(object){
        if (object['class'] == 'person') {
            ctx.strokeStyle = 'blue';
            var bboxdata = object['bbox']
            var personFocusedCanvas = createCanvas(bboxdata[2], bboxdata[3])
            var personFocusedCtx = personFocusedCanvas.getContext('2d')
            personFocusedCtx.drawImage(ctx.canvas, bboxdata[0], bboxdata[1], bboxdata[2], bboxdata[3], 0, 0, bboxdata[2], bboxdata[3])
            ctx.rect(bboxdata[0], bboxdata[1], bboxdata[2], bboxdata[3])
            ctx.stroke();
//            ctx.clip();
//            orginalCanvas = personFocusedCanvas
//            ctx = personFocusedCtx
            
        }
        
        return object['class'] == 'person';
    });
    
    
    
    const pose = await jointnet.estimateSinglePose(ctx.canvas);
    
    console.log("prediction for image is complete and drawing will begin")
    pose.keypoints.forEach(keypoint => {
        const {position: {x, y}} = keypoint;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI, false);
        ctx.fillStyle = 'red';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'red';
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
            ctx.lineWidth = 5;
            ctx.strokeStyle = 'red';
            ctx.lineTo(x2, y2);
            ctx.stroke();

        }
    })
    console.log("drawing complete and depth boolean will be computed")
    const leftDepthConfidence = pointsByPart['leftKnee']['score'] + pointsByPart['leftHip']['score']
    const rightDepthConfidence = pointsByPart['rightKnee']['score'] + pointsByPart['rightHip']['score']
    var didHitDepth = false
    if (leftDepthConfidence > rightDepthConfidence) {
        didHitDepth = pointsByPart['leftKnee']['position']['y'] < pointsByPart['leftHip']['position']['y'] 
    } else {
        didHitDepth = pointsByPart['rightKnee']['position']['y'] < pointsByPart['rightHip']['position']['y']
    }

    console.log("depth boolean: " + didHitDepth)
    hitDepthArray.push(didHitDepth)

    var buf = orginalCanvas.toBuffer();
    // return buf
    // fs.writeFileSync("test.png", buf);
    console.log("buffer for image is about to be returned")
    return buf     
}

async function analyzeImage (inputLocationInDB, outputLocationInDB) {
    var data = await bucket.file(inputLocationInDB).download()
    var contents = data[0]

    console.log(inputLocationInDB + " was downloaded: ")
    console.log(contents)

    var result = await analyze(contents)

    
    console.log(inputLocationInDB + " was analyzed")
    const file = bucket.file(outputLocationInDB);
    await file.save(result, function(err) {
        // if (!err) {
        //     // File written successfully.
        //     console.log("result was saved to db")
        // }

        // return !err;
    });
    console.log("result was saved to db");
    return true;

}

var analyzeListOfImages = async function(requestBody) {

    hitDepthArray = []
    var ref = db.ref(requestBody.videoId);
    console.log("running analyze list images method")
    for (var i = 0; i < requestBody.imageLocations.length; i++) {
        console.log("analyzing " + requestBody.imageLocations[i])
        var fileWasSaved = await analyzeImage(requestBody.imageLocations[i], requestBody.outputLocations[i])
        console.log("exited the await statement")

        var percentage = ((i + 1.0)/requestBody.imageLocations.length) * 100
        if (percentage < 100) {
            await ref.child("pose_completed").set(percentage)
        }
        
    }

    console.log("database directory " + requestBody.videoId);
    
    
    // var data = {"hit_depths": hitDepthArray};
    // console.log(data)
    await ref.child("hit_depths").set(hitDepthArray)
    await ref.child("pose_completed").set(100)

    
    console.log("depth values were uploaded to database and method will return")
    // .then(data => {
    //     console.log("depth values were uploaded to database")
    // });

    return;

}

module.exports = analyzeListOfImages;

// analyzeImage('poseImages/test/rep-1.jpg', 'analyzed-poseImages/test/adsfadsfasdf.jpg')