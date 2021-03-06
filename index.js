const express = require('express')
const app = express()
app.use(express.json())

var poseAnalyzerMethod = require("./poseAnalyzer.js")

app.get('/', (req, res) => {
  res.send('Server should be working now!');
})

app.post('/api/tasks/', (req, res) => {
  // res.send(req.params.timestamp_filename)

  //WRITE CODE TO SEE IF VIDEO EXISTS IN FIREBASE
  // var videoExists = true
  // if (!videoExists) return res.status(404).send('Video does not exist in the database')
  console.log(req.body)
  // res.status(200).send("server has recieved post request and will begin work...");
  res.end("the post request will continue but this request will be ended")
  poseAnalyzerMethod(req.body).then(data => {
    console.log("finished the whole post request")
  })
  console.log("return from express app.post method")
  return;
  

 
});

// app.get('/api/tasks/:timestamp_filename/status', (req, res) => {
//   // res.send(req.params.timestamp_filename)

//   //WRITE CODE TO SEE IF VIDEO EXISTS IN FIREBASE
//   var videoExists = true
//   if (!videoExists) return res.status(404).send('Video ' + req.params.timestamp_filename +' does not exist in the database')
 
//   res.status(400).send('Analysis of video ' + req.params.timestamp_filename +' is complete')

// });

const port = process.env.PORT || 3000
app.listen(port, () => console.log('Server running on port 3000'))


