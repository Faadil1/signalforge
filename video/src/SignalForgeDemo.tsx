import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {Audio} from '@remotion/media';

const BG = '#EEF3FF';
const INK = '#171522';
const MUTED = '#596174';
const BLUE = '#3257FF';
const CYAN = '#00C9E8';
const LIME = '#C6F432';
const PINK = '#FF4F73';

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const Grid: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundColor: BG,
      backgroundImage:
        'linear-gradient(rgba(50,87,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(50,87,255,.07) 1px, transparent 1px)',
      backgroundSize: '48px 48px',
    }}
  />
);

const Prism: React.FC<{size?: number}> = ({size = 92}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.24,
      background: '#fff',
      border: '2px solid #B9C6F2',
      boxShadow: '0 24px 60px rgba(50,87,255,.16)',
      display: 'grid',
      placeItems: 'center',
      overflow: 'hidden',
    }}
  >
    <Img src={staticFile('logo.svg')} style={{width: '100%', height: '100%'}} />
  </div>
);

const Wordmark: React.FC = () => (
  <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
    <Prism size={72} />
    <div>
      <div style={{fontSize: 36, fontWeight: 850, color: INK, letterSpacing: '-0.03em'}}>SignalForge</div>
      <div style={{fontSize: 17, color: MUTED, marginTop: 2}}>Evidence before recommendation.</div>
    </div>
  </div>
);

const Header: React.FC<{eyebrow: string}> = ({eyebrow}) => (
  <div
    style={{
      position: 'absolute',
      top: 48,
      left: 60,
      right: 60,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      zIndex: 10,
    }}
  >
    <Wordmark />
    <div
      style={{
        padding: '10px 16px',
        borderRadius: 999,
        border: '1px solid #B9C6F2',
        background: 'rgba(255,255,255,.86)',
        color: BLUE,
        fontWeight: 800,
        fontSize: 15,
        letterSpacing: '.08em',
        textTransform: 'uppercase',
      }}
    >
      {eyebrow}
    </div>
  </div>
);

const Caption: React.FC<{text: string}> = ({text}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const y = interpolate(frame, [0, 0.45 * fps], [24, 0], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const opacity = interpolate(frame, [0, 0.4 * fps], [0, 1], clamp);
  return (
    <div
      style={{
        position: 'absolute',
        left: 60,
        right: 60,
        bottom: 42,
        display: 'flex',
        justifyContent: 'center',
        opacity,
        translate: `0 ${y}px`,
        zIndex: 20,
      }}
    >
      <div
        style={{
          maxWidth: 1320,
          background: 'rgba(23,21,34,.92)',
          color: '#fff',
          padding: '18px 28px',
          borderRadius: 18,
          fontSize: 30,
          lineHeight: 1.28,
          fontWeight: 650,
          textAlign: 'center',
          boxShadow: '0 16px 48px rgba(23,21,34,.24)',
        }}
      >
        {text}
      </div>
    </div>
  );
};

const CaptureScene: React.FC<{
  src: string;
  eyebrow: string;
  title: string;
  body: string;
  caption: string;
  accent?: string;
  badge?: string;
}> = ({src, eyebrow, title, body, caption, accent = BLUE, badge}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 22, stiffness: 120, mass: 0.8}});
  const scale = interpolate(frame, [0, 8 * fps], [1.025, 1], {...clamp, easing: Easing.linear});
  return (
    <AbsoluteFill style={{background: BG, fontFamily: 'Inter, Arial, sans-serif', color: INK}}>
      <Grid />
      <Header eyebrow={eyebrow} />
      <div
        style={{
          position: 'absolute',
          left: 60,
          top: 156,
          width: 520,
          opacity: enter,
          translate: `${interpolate(enter, [0, 1], [-38, 0])}px 0`,
          zIndex: 5,
        }}
      >
        {badge ? (
          <div
            style={{
              display: 'inline-flex',
              padding: '8px 12px',
              borderRadius: 999,
              background: accent,
              color: accent === LIME ? INK : '#fff',
              fontSize: 16,
              fontWeight: 850,
              marginBottom: 22,
            }}
          >
            {badge}
          </div>
        ) : null}
        <h2 style={{fontSize: 62, lineHeight: 0.98, letterSpacing: '-0.05em', margin: 0}}>{title}</h2>
        <p style={{fontSize: 25, lineHeight: 1.45, color: MUTED, marginTop: 24}}>{body}</p>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 640,
          right: 60,
          top: 152,
          bottom: 118,
          borderRadius: 30,
          overflow: 'hidden',
          border: '2px solid rgba(50,87,255,.18)',
          boxShadow: '0 28px 90px rgba(50,87,255,.18)',
          background: '#fff',
          opacity: enter,
          scale,
          transformOrigin: 'center center',
        }}
      >
        <Img src={staticFile(src)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center'}} />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            boxShadow: `inset 0 0 0 3px ${accent}22`,
            pointerEvents: 'none',
          }}
        />
      </div>
      <Caption text={caption} />
    </AbsoluteFill>
  );
};

const Opening: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({frame: frame - 8, fps, config: {damping: 18, stiffness: 115}});
  const ruleOpacity = interpolate(frame, [0.8 * fps, 1.6 * fps], [0, 1], clamp);
  const ruleY = interpolate(frame, [0.8 * fps, 1.6 * fps], [22, 0], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  return (
    <AbsoluteFill style={{background: BG, color: INK, fontFamily: 'Inter, Arial, sans-serif'}}>
      <Grid />
      <div style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center'}}>
        <div style={{textAlign: 'center', width: 1500}}>
          <div style={{display: 'flex', justifyContent: 'center', marginBottom: 32, scale: pop}}>
            <Prism size={124} />
          </div>
          <div style={{fontSize: 108, fontWeight: 900, letterSpacing: '-0.06em'}}>SignalForge</div>
          <div style={{fontSize: 44, color: MUTED, marginTop: 12}}>Evidence before recommendation.</div>
          <div
            style={{
              opacity: ruleOpacity,
              translate: `0 ${ruleY}px`,
              marginTop: 54,
              display: 'inline-block',
              padding: '18px 28px',
              borderRadius: 18,
              background: '#fff',
              border: '1px solid #B9C6F2',
              fontSize: 27,
              fontWeight: 800,
              letterSpacing: '.02em',
            }}
          >
            AVAILABLE ≠ FRESH ≠ CONSISTENT ≠ ACTIONABLE
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const RefusalScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const gate = spring({frame: frame - 16, fps, config: {damping: 18, stiffness: 115}});
  return (
    <AbsoluteFill style={{background: BG, color: INK, fontFamily: 'Inter, Arial, sans-serif'}}>
      <Grid />
      <Header eyebrow="Fail closed" />
      <div style={{position: 'absolute', top: 205, left: 120, right: 120, textAlign: 'center'}}>
        <div style={{fontSize: 34, color: MUTED, fontWeight: 700}}>When usable evidence falls below policy</div>
        <div
          style={{
            margin: '42px auto 30px',
            width: 760,
            padding: '52px 44px',
            borderRadius: 34,
            border: `3px solid ${PINK}`,
            background: '#fff',
            boxShadow: '0 32px 90px rgba(255,79,115,.18)',
            scale: gate,
          }}
        >
          <div style={{fontSize: 30, color: PINK, fontWeight: 900, letterSpacing: '.12em'}}>DIRECTIONAL HANDOFF</div>
          <div style={{fontSize: 118, fontWeight: 950, letterSpacing: '-0.05em', marginTop: 10}}>REFUSED</div>
        </div>
        <div style={{fontSize: 32, lineHeight: 1.4, maxWidth: 1100, margin: '0 auto', color: MUTED}}>
          SignalForge excludes weak inputs and abstains instead of manufacturing confidence.
        </div>
      </div>
      <Caption text="Missing evidence is a reason to stop, not a reason to invent a neutral score." />
    </AbsoluteFill>
  );
};

const ProofScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 24, stiffness: 100}});
  return (
    <AbsoluteFill style={{background: BG, color: INK, fontFamily: 'Inter, Arial, sans-serif'}}>
      <Grid />
      <Header eyebrow="Runtime proof" />
      <div style={{position: 'absolute', top: 190, left: 100, right: 100, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 34}}>
        <div style={{background: '#fff', border: '1px solid #B9C6F2', borderRadius: 30, padding: 44, opacity: enter}}>
          <div style={{fontSize: 20, color: BLUE, fontWeight: 900, letterSpacing: '.12em'}}>LIVE SOURCE BINDING</div>
          <div style={{fontSize: 52, fontWeight: 900, marginTop: 22}}>Health + X-Agent agree</div>
          <div style={{fontFamily: 'monospace', fontSize: 22, lineHeight: 1.55, color: MUTED, marginTop: 30, wordBreak: 'break-all'}}>
            087a9d9db98b5ec53da04bae0e8b07f2a4b7f976
          </div>
          <div style={{marginTop: 28, display: 'inline-flex', gap: 12, alignItems: 'center', fontSize: 22, fontWeight: 800}}>
            <span style={{width: 14, height: 14, borderRadius: 999, background: LIME, border: `2px solid ${INK}`}} />
            mock fallback disabled
          </div>
        </div>
        <div style={{background: INK, color: '#fff', borderRadius: 30, padding: 44, opacity: enter}}>
          <div style={{fontSize: 20, color: CYAN, fontWeight: 900, letterSpacing: '.12em'}}>AGENT CONTRACT</div>
          <div style={{fontSize: 52, fontWeight: 900, marginTop: 22}}>REST + MCP</div>
          <div style={{fontSize: 28, color: '#CED4E0', lineHeight: 1.5, marginTop: 28}}>
            Same evidence semantics. Same authority boundary. No trading side effects.
          </div>
          <div style={{marginTop: 34, padding: '18px 20px', borderRadius: 16, background: '#282536', fontFamily: 'monospace', fontSize: 22}}>
            execution_authorized: false
          </div>
        </div>
      </div>
      <Caption text="The live runtime identifies the exact source that produced it — and the agent interface stays read-only." />
    </AbsoluteFill>
  );
};

const Closing: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({frame: frame - 8, fps, config: {damping: 18, stiffness: 105}});
  return (
    <AbsoluteFill style={{background: INK, color: '#fff', fontFamily: 'Inter, Arial, sans-serif'}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 20% 20%, rgba(50,87,255,.42), transparent 36%), radial-gradient(circle at 80% 25%, rgba(255,79,115,.34), transparent 34%), radial-gradient(circle at 55% 82%, rgba(198,244,50,.22), transparent 31%)',
        }}
      />
      <div style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center'}}>
        <div style={{scale: pop}}>
          <div style={{display: 'flex', justifyContent: 'center', marginBottom: 34}}><Prism size={118} /></div>
          <div style={{fontSize: 104, fontWeight: 950, letterSpacing: '-0.06em'}}>Evidence before recommendation.</div>
          <div style={{fontSize: 34, color: '#CED4E0', marginTop: 24}}>SignalForge · REST + MCP · Read-only authority</div>
          <div style={{fontFamily: 'monospace', fontSize: 23, color: LIME, marginTop: 38}}>signalforge.faadil-casecraft.workers.dev</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const SignalForgeDemo: React.FC = () => (
  <AbsoluteFill>
    <Audio src={staticFile('voiceover.mp3')} />

    <Sequence from={0} durationInFrames={180}>
      <Opening />
    </Sequence>

    <Sequence from={180} durationInFrames={330}>
      <CaptureScene
        src="captures/home.png"
        eyebrow="The question"
        title="Can this evidence earn a handoff?"
        body="SignalForge starts before the recommendation. It asks whether the underlying evidence is fresh, usable and sufficient."
        caption="Most market agents ask for a signal. SignalForge first asks whether the evidence is good enough to hand off at all."
        accent={BLUE}
      />
    </Sequence>

    <Sequence from={510} durationInFrames={390}>
      <CaptureScene
        src="captures/dashboard.png"
        eyebrow="Admission gate"
        title="Weak inputs do not get a vote."
        body="Stale, unavailable or inconsistent inputs are excluded before fusion. Coverage and evidence debt remain visible."
        caption="Freshness and quality are checked before fusion — missing evidence is excluded instead of silently becoming neutral."
        accent={CYAN}
        badge="ADMIT / EXCLUDE"
      />
    </Sequence>

    <Sequence from={900} durationInFrames={390}>
      <CaptureScene
        src="captures/token.png"
        eyebrow="Decision Packet"
        title="The score is inspectable."
        body="Support, contradiction, confidence, coverage, lineage, invalidation and valid-until travel with the conclusion."
        caption="The result is an evidence-bound Decision Packet, not a naked recommendation."
        accent={LIME}
        badge="LINEAGE + LEASE + RECEIPT"
      />
    </Sequence>

    <Sequence from={1290} durationInFrames={360}>
      <RefusalScene />
    </Sequence>

    <Sequence from={1650} durationInFrames={420}>
      <ProofScene />
    </Sequence>

    <Sequence from={2070} durationInFrames={390}>
      <Closing />
    </Sequence>
  </AbsoluteFill>
);
