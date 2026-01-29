#!/usr/bin/env node
/**
 * App Store Screenshots Automation
 * Phase 5: Mobile Parity & Production - Step 90
 * 
 * Generates marketing screenshots for iOS App Store and Google Play Store
 * using Detox/Maestro or manual capture with device simulators.
 * 
 * Usage:
 *   node scripts/generate-screenshots.js --platform ios
 *   node scripts/generate-screenshots.js --platform android
 *   node scripts/generate-screenshots.js --all
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Screenshot configurations for different device sizes
const DEVICE_CONFIGS = {
  ios: [
    { name: 'iPhone 15 Pro Max', width: 1290, height: 2796, scale: 3 },
    { name: 'iPhone 15 Pro', width: 1179, height: 2556, scale: 3 },
    { name: 'iPhone SE', width: 750, height: 1334, scale: 2 },
    { name: 'iPad Pro 12.9', width: 2048, height: 2732, scale: 2 },
    { name: 'iPad Pro 11', width: 1668, height: 2388, scale: 2 },
  ],
  android: [
    { name: 'phone', width: 1080, height: 1920, dpi: 420 },
    { name: 'phone-large', width: 1440, height: 3120, dpi: 560 },
    { name: 'tablet-7', width: 1200, height: 1920, dpi: 240 },
    { name: 'tablet-10', width: 1600, height: 2560, dpi: 320 },
  ],
};

// Screens to capture for marketing
const MARKETING_SCREENS = [
  { 
    name: 'home-feed',
    route: '/',
    description: 'Discover opportunities tailored for you',
    waitFor: 3000,
  },
  {
    name: 'video-feed',
    route: '/feed',
    description: 'TikTok-style career content',
    waitFor: 2000,
  },
  {
    name: 'jobs',
    route: '/jobs',
    description: 'Find your dream job',
    waitFor: 2000,
  },
  {
    name: 'messages',
    route: '/messages',
    description: 'Connect with mentors and peers',
    waitFor: 2000,
  },
  {
    name: 'profile',
    route: '/profile',
    description: 'Your professional journey',
    waitFor: 2000,
  },
  {
    name: 'mentor-booking',
    route: '/mentors',
    description: 'Book sessions with industry experts',
    waitFor: 2000,
  },
];

const OUTPUT_DIR = path.join(__dirname, '..', 'screenshots');
const FASTLANE_DIR = path.join(__dirname, '..', 'fastlane', 'screenshots');

function ensureDirectories(platform) {
  const dirs = [
    OUTPUT_DIR,
    path.join(OUTPUT_DIR, platform),
    FASTLANE_DIR,
    path.join(FASTLANE_DIR, platform),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  }
}

function generateMaestroFlow(screen, device) {
  return `
appId: com.athena.app
---
- launchApp:
    clearState: true
- waitForAnimationToEnd
- extendedWaitUntil:
    visible: "Home"
    timeout: 10000
- navigate: ${screen.route}
- waitForAnimationToEnd
- extendedWaitUntil:
    timeout: ${screen.waitFor}
- takeScreenshot: ${screen.name}_${device.name}
`;
}

function generateDetoxTestFile() {
  const tests = MARKETING_SCREENS.map(screen => `
  it('should capture ${screen.name} screenshot', async () => {
    await device.reloadReactNative();
    // Navigate to screen
    ${screen.route !== '/' ? `await element(by.text('${screen.name.replace('-', ' ')}')).tap();` : ''}
    await waitFor(element(by.id('${screen.name}-screen')))
      .toBeVisible()
      .withTimeout(5000);
    await device.takeScreenshot('${screen.name}');
  });
`).join('\n');

  return `
describe('Marketing Screenshots', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  afterAll(async () => {
    await device.terminateApp();
  });

${tests}
});
`;
}

async function captureIOSScreenshots() {
  console.log('📱 Capturing iOS screenshots...');
  ensureDirectories('ios');

  for (const device of DEVICE_CONFIGS.ios) {
    console.log(`  📸 Device: ${device.name}`);
    
    // Boot simulator if not running
    try {
      execSync(`xcrun simctl boot "${device.name}"`, { stdio: 'ignore' });
    } catch (e) {
      // Already booted
    }

    for (const screen of MARKETING_SCREENS) {
      const filename = `${screen.name}_${device.name.replace(/\s+/g, '_')}.png`;
      const outputPath = path.join(OUTPUT_DIR, 'ios', filename);
      
      console.log(`    → ${screen.name}`);
      
      // Using xcrun simctl for screenshot capture
      try {
        execSync(
          `xcrun simctl io "${device.name}" screenshot "${outputPath}"`,
          { stdio: 'inherit' }
        );
      } catch (error) {
        console.error(`    ⚠️ Failed to capture ${screen.name} on ${device.name}`);
      }
    }
  }

  console.log('✅ iOS screenshots complete');
}

async function captureAndroidScreenshots() {
  console.log('🤖 Capturing Android screenshots...');
  ensureDirectories('android');

  for (const device of DEVICE_CONFIGS.android) {
    console.log(`  📸 Device: ${device.name}`);

    for (const screen of MARKETING_SCREENS) {
      const filename = `${screen.name}_${device.name}.png`;
      const outputPath = path.join(OUTPUT_DIR, 'android', filename);

      console.log(`    → ${screen.name}`);

      // Using adb for screenshot capture
      try {
        execSync(
          `adb shell screencap -p /sdcard/screenshot.png && adb pull /sdcard/screenshot.png "${outputPath}"`,
          { stdio: 'inherit' }
        );
      } catch (error) {
        console.error(`    ⚠️ Failed to capture ${screen.name} on ${device.name}`);
      }
    }
  }

  console.log('✅ Android screenshots complete');
}

function generateFramedScreenshots() {
  console.log('🖼️ Generating framed screenshots with device bezels...');
  
  // This would integrate with tools like:
  // - fastlane frameit
  // - Screenshots.app
  // - Device Art Generator
  
  const frameScript = `
# Framing script for fastlane
# Add to Fastfile:
# 
# lane :screenshots do
#   capture_ios_screenshots
#   frame_screenshots(
#     white: true,
#     path: "./fastlane/screenshots"
#   )
# end
`;

  fs.writeFileSync(
    path.join(FASTLANE_DIR, 'Framefile.json'),
    JSON.stringify({
      device_frame_version: 'latest',
      default: {
        title: {
          font: './fonts/Poppins-Bold.ttf',
          color: '#000000',
        },
        background: '#FFFFFF',
        padding: 50,
        show_complete_frame: true,
        title_below_image: true,
      },
      data: MARKETING_SCREENS.map(screen => ({
        filter: screen.name,
        title: {
          text: screen.description,
        },
      })),
    }, null, 2)
  );

  console.log('✅ Frame configuration generated');
}

function generateEASScreenshotConfig() {
  // EAS Build screenshot configuration
  const easConfig = {
    build: {
      preview: {
        distribution: 'internal',
        ios: {
          simulator: true,
          resourceClass: 'large',
        },
        android: {
          buildType: 'apk',
        },
      },
      screenshots: {
        extends: 'preview',
        env: {
          SCREENSHOT_MODE: 'true',
        },
      },
    },
  };

  console.log('📝 EAS screenshot config:', JSON.stringify(easConfig, null, 2));
  return easConfig;
}

async function main() {
  const args = process.argv.slice(2);
  const platform = args.includes('--platform') 
    ? args[args.indexOf('--platform') + 1]
    : 'all';

  console.log('🚀 ATHENA App Store Screenshot Generator\n');

  // Generate test files
  const detoxTestPath = path.join(__dirname, '..', 'e2e', 'screenshots.e2e.js');
  fs.mkdirSync(path.dirname(detoxTestPath), { recursive: true });
  fs.writeFileSync(detoxTestPath, generateDetoxTestFile());
  console.log(`📝 Generated Detox test: ${detoxTestPath}`);

  // Generate Maestro flows
  const maestroDir = path.join(__dirname, '..', '.maestro', 'screenshots');
  fs.mkdirSync(maestroDir, { recursive: true });
  for (const screen of MARKETING_SCREENS) {
    const flowPath = path.join(maestroDir, `${screen.name}.yaml`);
    fs.writeFileSync(flowPath, generateMaestroFlow(screen, DEVICE_CONFIGS.ios[0]));
  }
  console.log(`📝 Generated Maestro flows: ${maestroDir}`);

  // Capture screenshots based on platform
  if (platform === 'ios' || platform === 'all') {
    await captureIOSScreenshots();
  }

  if (platform === 'android' || platform === 'all') {
    await captureAndroidScreenshots();
  }

  // Generate framing config
  generateFramedScreenshots();

  console.log('\n📦 Screenshots saved to:', OUTPUT_DIR);
  console.log('\n💡 Tips:');
  console.log('  - Use `fastlane frameit` to add device frames');
  console.log('  - Run `maestro test .maestro/screenshots/` for automated capture');
  console.log('  - Configure EAS Build for CI screenshot generation');
}

main().catch(console.error);
