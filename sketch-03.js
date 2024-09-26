const canvasSketch = require('canvas-sketch');
const random = require('canvas-sketch-util/random');
const math = require('canvas-sketch-util/math');

let midiOutput;

// Request MIDI access in the browser
if (navigator.requestMIDIAccess) {
  navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
} else {
  console.error('Web MIDI is not supported in this browser.');
}

function onMIDISuccess(midiAccess) {
  const outputs = midiAccess.outputs.values();
  for (let output of outputs) {
    midiOutput = output; // Get the first available MIDI output
    console.log('MIDI Output selected:', midiOutput.name);
  }
}

function onMIDIFailure() {
  console.error('Could not access your MIDI devices.');
}

const settings = {
  dimensions: [1080, 1350], // Instagram-friendly portrait aspect ratio (4:5)
  animate: true,
  fps: 60, // Max FPS for smooth visuals
  exportPixelRatio: 2, // High-quality export
};

const INITIAL_POINTS = 300; // Start with a large set of points
const THOUGHTS_PER_SECOND = 0.5; // Continuous generation of new thoughts, but not too fast
const POINT_LIFESPAN_MIN = 60; // Shorter minimum lifespan
const POINT_LIFESPAN_MAX = 180; // Randomize the lifespan between 1 to 3 minutes
const MIN_ACTIVE_POINTS = 150; // Ensure a stable minimum number of points at all times

const NOTE_MIN = 36; // C3
const NOTE_MAX = 72; // C6
const VELOCITY_MIN = 40;
const VELOCITY_MAX = 100;

const sketch = ({ context, width, height }) => {
  let points = [];

  // Initialize with a large set of points
  for (let i = 0; i < INITIAL_POINTS; i++) {
    const x = random.range(0, width);
    const y = random.range(0, height);
    points.push(new Point(x, y));
  }

  return ({ context, width, height, time }) => {
    // Fading effect for the background
    context.fillStyle = 'rgba(10, 2, 2, 0.2)';
    context.fillRect(0, 0, width, height);

    // Ensure a minimum number of points always exist
    while (points.length < MIN_ACTIVE_POINTS) {
      const x = random.range(0, width);
      const y = random.range(0, height);
      points.push(new Point(x, y));
    }

    // Generate new thoughts at a continuous rate (based on the frame rate)
    if (random.chance(THOUGHTS_PER_SECOND / 60)) {
      const x = random.range(0, width);
      const y = random.range(0, height);
      points.push(new Point(x, y));
    }

    // Draw connections between points
    const dynamicThreshold = math.mapRange(Math.sin(time * 0.5), -1, 1, 100, 150);

    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];

      for (let j = i + 1; j < points.length; j++) {
        const p2 = points[j];
        const dist = p1.pos.getDistance(p2.pos);

        if (dist > dynamicThreshold) continue;

        const alpha = math.mapRange(dist, 0, dynamicThreshold, 0.6, 0);
        context.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        context.lineWidth = math.mapRange(dist, 0, dynamicThreshold, 1.5, 0.5);
        context.beginPath();
        context.moveTo(p1.pos.x, p1.pos.y);
        context.lineTo(p2.pos.x, p2.pos.y);
        context.stroke();
      }
    }

    // Update and draw points
    points.forEach((point, index) => {
      point.update(width, height, time);
      point.draw(context);

      // MIDI Mapping Logic (Web MIDI API)
      const midiNote = mapRange(point.pos.x, 0, width, NOTE_MIN, NOTE_MAX);
      const velocity = mapRange(point.pos.y, 0, height, VELOCITY_MIN, VELOCITY_MAX);

      // Send Note On when the point is created (if MIDI is available)
      if (point.age === 0 && midiOutput) {
        midiOutput.send([144, midiNote, velocity]); // 144 = Note On
      }

      // Increment age and check lifespan
      point.age += 1 / settings.fps;

      // Remove the point if it has reached the end of its lifespan
      if (point.age >= point.lifespan && midiOutput) {
        midiOutput.send([128, midiNote, 0]); // 128 = Note Off
        points.splice(index, 1); // Remove the point
      }
    });
  };
};

canvasSketch(sketch, settings);

// Helper classes and functions
class Vector {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  getDistance(v) {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

class Point {
  constructor(x, y) {
    this.pos = new Vector(x, y);
    this.vel = new Vector(random.range(-0.2, 0.2), random.range(-0.2, 0.2));
    this.radius = 3;
    this.age = 0;
    this.lifespan = random.range(POINT_LIFESPAN_MIN, POINT_LIFESPAN_MAX); // Randomize lifespan
  }

  update(width, height, time) {
    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;

    if (this.pos.x < 0) this.pos.x = width;
    if (this.pos.x > width) this.pos.x = 0;
    if (this.pos.y < 0) this.pos.y = height;
    if (this.pos.y > height) this.pos.y = 0;
  }

  draw(context) {
    const alpha = math.mapRange(this.age, 0, this.lifespan, 1, 0); // Fade out over lifespan
    context.save();
    context.translate(this.pos.x, this.pos.y);
    context.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    context.beginPath();
    context.arc(0, 0, this.radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
}

// Helper function to map ranges
function mapRange(value, inMin, inMax, outMin, outMax) {
  return Math.round((value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin);
}