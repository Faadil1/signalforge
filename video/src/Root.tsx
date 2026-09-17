import React from 'react';
import {Composition} from 'remotion';
import {SignalForgeDemo} from './SignalForgeDemo';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="SignalForgeDemo"
      component={SignalForgeDemo}
      durationInFrames={2460}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
