import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Path,
  RadialGradient,
  Stop,
  Use,
} from 'react-native-svg';
import Colors from '@/constants/colors';

const DURATION_MS = 3000;

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedUse = Animated.createAnimatedComponent(Use);

type MainLoaderProps = {
  size?: number;
};

export default function MainLoader({ size = 240 }: MainLoaderProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: DURATION_MS,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );

    loop.start();
    return () => loop.stop();
  }, [progress]);

  const faceOpacity = progress.interpolate({
    inputRange: [0, 0.08, 0.92, 1],
    outputRange: [0, 1, 1, 0],
    extrapolate: 'clamp',
  });
  const faceScale = progress.interpolate({
    inputRange: [0, 0.08, 0.12, 0.92, 1],
    outputRange: [0.8, 1.06, 1, 1, 0.95],
    extrapolate: 'clamp',
  });

  const bracketOpacity = progress.interpolate({
    inputRange: [0, 0.1, 0.18, 0.92, 1],
    outputRange: [0, 0, 1, 1, 0],
    extrapolate: 'clamp',
  });
  const bracketScale = progress.interpolate({
    inputRange: [0, 0.1, 0.18, 0.25, 0.7, 0.78, 0.92, 1],
    outputRange: [1.2, 1.2, 1.05, 0.92, 0.92, 1, 1, 1.05],
    extrapolate: 'clamp',
  });

  const heartOpacity = progress.interpolate({
    inputRange: [0, 0.45, 0.5, 0.92, 1],
    outputRange: [0, 0, 1, 1, 0],
    extrapolate: 'clamp',
  });
  const heartScale = progress.interpolate({
    inputRange: [0, 0.45, 0.5, 0.54, 0.58, 0.92, 1],
    outputRange: [0, 0, 1.4, 0.9, 1, 1, 0],
    extrapolate: 'clamp',
  });
  const heartRotate = progress.interpolate({
    inputRange: [0, 0.45, 0.5, 0.54, 0.58, 1],
    outputRange: [0, 0, 12, -6, 0, 0],
    extrapolate: 'clamp',
  });

  const rippleOpacity = progress.interpolate({
    inputRange: [0, 0.55, 0.6, 0.78, 1],
    outputRange: [0, 0, 0.8, 0, 0],
    extrapolate: 'clamp',
  });
  const rippleScale = progress.interpolate({
    inputRange: [0, 0.55, 0.78, 1],
    outputRange: [0.8, 0.8, 1.6, 1.6],
    extrapolate: 'clamp',
  });
  const rippleStrokeWidth = progress.interpolate({
    inputRange: [0, 0.55, 0.6, 0.78, 1],
    outputRange: [3, 3, 2, 0, 0],
    extrapolate: 'clamp',
  });

  const glowOpacity = progress.interpolate({
    inputRange: [0, 0.7, 0.78, 0.92, 1],
    outputRange: [0, 0, 1, 1, 0],
    extrapolate: 'clamp',
  });
  const glowScale = progress.interpolate({
    inputRange: [0, 0.7, 0.78, 0.92, 1],
    outputRange: [0.7, 0.7, 1, 1, 1.1],
    extrapolate: 'clamp',
  });

  const strokeColor = progress.interpolate({
    inputRange: [0, 0.7, 0.78, 0.92, 1],
    outputRange: ['#4e736f', '#4e736f', '#00d98a', '#00d98a', '#4e736f'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.wrapper}>
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Defs>
          <RadialGradient id="glowGradient" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#00d98a" stopOpacity={0.4} />
            <Stop offset="50%" stopColor="#00d98a" stopOpacity={0.1} />
            <Stop offset="100%" stopColor="#00d98a" stopOpacity={0} />
          </RadialGradient>
          <G id="sparkHeart">
            <Path d="M 0 3 A 3 3 0 0 1 6 3 A 3 3 0 0 1 12 3 Q 12 8 6 12 Q 0 8 0 3 z" />
          </G>
        </Defs>

        <AnimatedCircle
          cx={60}
          cy={60}
          r={34}
          fill="url(#glowGradient)"
          opacity={glowOpacity}
          scale={glowScale}
          originX={60}
          originY={60}
        />

        <AnimatedCircle
          cx={60}
          cy={60}
          r={18}
          fill="none"
          stroke="#00d98a"
          opacity={rippleOpacity}
          scale={rippleScale}
          originX={60}
          originY={60}
          strokeWidth={rippleStrokeWidth}
        />

        <AnimatedG
          fill="none"
          stroke={strokeColor}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={faceOpacity}
          scale={faceScale}
          originX={60}
          originY={60}
        >
          <Circle cx={60} cy={60} r={16} />
          <Path d="M 54 57 Q 55 55 56 57 M 64 57 Q 65 55 66 57" />
          <Path d="M 55 63 Q 60 67 65 63" />
        </AnimatedG>

        <AnimatedG
          fill="none"
          stroke={strokeColor}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={bracketOpacity}
          scale={bracketScale}
          originX={60}
          originY={60}
        >
          <Path d="M 40 48 L 40 40 L 48 40" />
          <Path d="M 72 40 L 80 40 L 80 48" />
          <Path d="M 80 72 L 80 80 L 72 80" />
          <Path d="M 48 80 L 40 80 L 40 72" />
        </AnimatedG>

        <AnimatedUse
          href="#sparkHeart"
          x={78}
          y={30}
          fill="#00ffcc"
          opacity={heartOpacity}
          scale={heartScale}
          rotation={heartRotate}
          originX={84}
          originY={36}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
});
