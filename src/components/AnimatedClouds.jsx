import React from 'react';
import '../style/css/clouds.css';

const AnimatedClouds = () => {
  const clouds = [
    // Left to Right (LTR)
    { id: 1, size: 'max(15vw, 120px)', height: 'max(5vw, 40px)', top: '15%', duration: '40s', delay: '-22s', dir: 'LTR', opacity: 0.8 },
    { id: 2, size: 'max(25vw, 200px)', height: 'max(8vw, 65px)', top: '55%', duration: '55s', delay: '-41s', dir: 'LTR', opacity: 0.6 },
    { id: 3, size: 'max(12vw, 100px)', height: 'max(4vw, 33px)', top: '35%', duration: '35s', delay: '-12s', dir: 'LTR', opacity: 0.7 },
    { id: 4, size: 'max(30vw, 240px)', height: 'max(10vw, 80px)', top: '75%', duration: '65s', delay: '-10s', dir: 'LTR', opacity: 0.5 },
    { id: 9, size: 'max(20vw, 160px)', height: 'max(6.5vw, 52px)', top: '25%', duration: '45s', delay: '-38s', dir: 'LTR', opacity: 0.9 },
    
    // Right to Left (RTL)
    { id: 5, size: 'max(18vw, 145px)', height: 'max(6vw, 48px)', top: '45%', duration: '42s', delay: '-10s', dir: 'RTL', opacity: 0.7 },
    { id: 6, size: 'max(28vw, 220px)', height: 'max(9vw, 72px)', top: '5%', duration: '60s', delay: '-27s', dir: 'RTL', opacity: 0.5 },
    { id: 7, size: 'max(14vw, 115px)', height: 'max(4.5vw, 38px)', top: '80%', duration: '38s', delay: '-4s', dir: 'RTL', opacity: 0.8 },
    { id: 8, size: 'max(22vw, 175px)', height: 'max(7vw, 58px)', top: '65%', duration: '48s', delay: '-36s', dir: 'RTL', opacity: 0.6 },
    { id: 10, size: 'max(16vw, 130px)', height: 'max(5vw, 43px)', top: '50%', duration: '50s', delay: '-47s', dir: 'RTL', opacity: 0.9 },
  ];

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {clouds.map(cloud => {
        const animationName = cloud.dir === 'LTR' ? 'cloudMoveLTR' : 'cloudMoveRTL';
        return (
          <div
            key={cloud.id}
            className="animated-cloud"
            style={{
              width: cloud.size,
              height: cloud.height,
              top: cloud.top,
              opacity: cloud.opacity,
              animation: `${animationName} ${cloud.duration} linear infinite`,
              animationDelay: cloud.delay,
            }}
          />
        );
      })}
    </div>
  );
};

export default AnimatedClouds;
