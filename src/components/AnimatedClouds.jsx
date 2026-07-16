import React from 'react';
import '../style/css/clouds.css';

const AnimatedClouds = () => {
  const clouds = [
    // Left to Right (LTR)
    { id: 1, size: '15vw', height: '5vw', top: '15%', duration: '40s', delay: '-22s', dir: 'LTR', opacity: 0.8 },
    { id: 2, size: '25vw', height: '8vw', top: '55%', duration: '55s', delay: '-41s', dir: 'LTR', opacity: 0.6 },
    { id: 3, size: '12vw', height: '4vw', top: '35%', duration: '35s', delay: '-12s', dir: 'LTR', opacity: 0.7 },
    { id: 4, size: '30vw', height: '10vw', top: '75%', duration: '65s', delay: '-10s', dir: 'LTR', opacity: 0.5 },
    { id: 9, size: '20vw', height: '6.5vw', top: '25%', duration: '45s', delay: '-38s', dir: 'LTR', opacity: 0.9 },
    
    // Right to Left (RTL)
    { id: 5, size: '18vw', height: '6vw', top: '45%', duration: '42s', delay: '-10s', dir: 'RTL', opacity: 0.7 },
    { id: 6, size: '28vw', height: '9vw', top: '5%', duration: '60s', delay: '-27s', dir: 'RTL', opacity: 0.5 },
    { id: 7, size: '14vw', height: '4.5vw', top: '80%', duration: '38s', delay: '-4s', dir: 'RTL', opacity: 0.8 },
    { id: 8, size: '22vw', height: '7vw', top: '65%', duration: '48s', delay: '-36s', dir: 'RTL', opacity: 0.6 },
    { id: 10, size: '16vw', height: '5vw', top: '50%', duration: '50s', delay: '-47s', dir: 'RTL', opacity: 0.9 },
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
