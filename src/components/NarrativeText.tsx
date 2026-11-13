import { useEffect, useState } from 'react';
import gsap from 'gsap';
import type { MotionValue } from 'motion';
import type { TextBlock } from '../scenes/types';

type NarrativeTextProps = {
  progress: MotionValue<number>;
  blocks: TextBlock[];
};

export default function NarrativeText({ progress, blocks }: NarrativeTextProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const update = (value: number) => {
      let nextIndex = 0;
      blocks.forEach((block, blockIndex) => {
        if (value >= block.at) nextIndex = blockIndex;
      });
      setIndex(nextIndex);
    };

    update(progress.get());
    return progress.on('change', update);
  }, [blocks, progress]);

  const block = blocks[Math.min(index, blocks.length - 1)] ?? blocks[0];
  if (!block) return null;

  return (
    <div className="narrative" key={block.title}>
      <div
        ref={(element) => {
          if (element) {
            gsap.fromTo(
              element,
              { y: 18, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' },
            );
          }
        }}
      >
        <p className="eyebrow">{block.eyebrow}</p>
        <h2>{block.title}</h2>
        <p className="body-copy">{block.body}</p>
      </div>
    </div>
  );
}
