module.exports = {
  apps: [{
    name: 'tutorial-2',
    script: './index.js'
  }],
  deploy: {
    production: {
      user: 'ubuntu',
	host: 'ec2-13-57-241-141.us-west-1.compute.amazonaws.com',
      key: '~/desktop/pose.pem',
      ref: 'origin/master',
      repo: 'https://github.com/vitae-gravitas/pose-server.git',
      path: '/home/ubuntu/pose-server',
      'post-deploy': 'npm install && pm2 startOrRestart ecosystem.config.js' //conda activate tf_gpu14_p35 &&
    }
  }
}
