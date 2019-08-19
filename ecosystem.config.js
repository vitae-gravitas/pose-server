module.exports = {
  apps: [{
    name: 'tutorial-2',
    script: './index.js'
  }],
  deploy: {
    production: {
      user: 'ubuntu',
	host: 'ec2-54-193-77-222.us-west-1.compute.amazonaws.com',
      key: '~/desktop/pose.pem',
      ref: 'origin/master',
      repo: 'https://github.com/vitae-gravitas/pose-server.git',
      path: '/home/ubuntu/poser-server',
      'post-deploy': 'npm install && pm2 startOrRestart ecosystem.config.js'
    }
  }
}
