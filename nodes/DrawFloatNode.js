import { NodeType } from "./NodeType.js";
import { NODE_COLORS } from "./PortTypes.js";

export const DrawFloatNode = new NodeType(
  "Draw Float",
  [
    { name: "UV", type: "vec2" },
    { name: "Position", type: "vec2" },
    { name: "Value", type: "float" },
    { name: "Size", type: "float", defaultValue: 1.0 },
  ],
  [{ name: "Color", type: "vec3" }],
  NODE_COLORS.debug,
  {
    webgl1: {
      dependency: `
// Simple 3x5 bitmap font for digits 0-9, decimal point, and minus sign
float getDigitPixel(int digit, vec2 pixelPos) {
    // Each digit is 3 pixels wide, 5 pixels tall
    int x = int(pixelPos.x);
    int y = int(pixelPos.y);
    
    if (x < 0 || x >= 3 || y < 0 || y >= 5) return 0.0;
    
    int index = y * 3 + x;
    
    // Digit bitmaps (1 = pixel on, 0 = pixel off)
    // 0
    if (digit == 0) {
        int bitmap[15];
        bitmap[0] = 1; bitmap[1] = 1; bitmap[2] = 1;
        bitmap[3] = 1; bitmap[4] = 0; bitmap[5] = 1;
        bitmap[6] = 1; bitmap[7] = 0; bitmap[8] = 1;
        bitmap[9] = 1; bitmap[10] = 0; bitmap[11] = 1;
        bitmap[12] = 1; bitmap[13] = 1; bitmap[14] = 1;
        return float(bitmap[index]);
    }
    // 1
    else if (digit == 1) {
        int bitmap[15];
        bitmap[0] = 0; bitmap[1] = 1; bitmap[2] = 0;
        bitmap[3] = 1; bitmap[4] = 1; bitmap[5] = 0;
        bitmap[6] = 0; bitmap[7] = 1; bitmap[8] = 0;
        bitmap[9] = 0; bitmap[10] = 1; bitmap[11] = 0;
        bitmap[12] = 1; bitmap[13] = 1; bitmap[14] = 1;
        return float(bitmap[index]);
    }
    // 2
    else if (digit == 2) {
        int bitmap[15];
        bitmap[0] = 1; bitmap[1] = 1; bitmap[2] = 1;
        bitmap[3] = 0; bitmap[4] = 0; bitmap[5] = 1;
        bitmap[6] = 1; bitmap[7] = 1; bitmap[8] = 1;
        bitmap[9] = 1; bitmap[10] = 0; bitmap[11] = 0;
        bitmap[12] = 1; bitmap[13] = 1; bitmap[14] = 1;
        return float(bitmap[index]);
    }
    // 3
    else if (digit == 3) {
        int bitmap[15];
        bitmap[0] = 1; bitmap[1] = 1; bitmap[2] = 1;
        bitmap[3] = 0; bitmap[4] = 0; bitmap[5] = 1;
        bitmap[6] = 1; bitmap[7] = 1; bitmap[8] = 1;
        bitmap[9] = 0; bitmap[10] = 0; bitmap[11] = 1;
        bitmap[12] = 1; bitmap[13] = 1; bitmap[14] = 1;
        return float(bitmap[index]);
    }
    // 4
    else if (digit == 4) {
        int bitmap[15];
        bitmap[0] = 1; bitmap[1] = 0; bitmap[2] = 1;
        bitmap[3] = 1; bitmap[4] = 0; bitmap[5] = 1;
        bitmap[6] = 1; bitmap[7] = 1; bitmap[8] = 1;
        bitmap[9] = 0; bitmap[10] = 0; bitmap[11] = 1;
        bitmap[12] = 0; bitmap[13] = 0; bitmap[14] = 1;
        return float(bitmap[index]);
    }
    // 5
    else if (digit == 5) {
        int bitmap[15];
        bitmap[0] = 1; bitmap[1] = 1; bitmap[2] = 1;
        bitmap[3] = 1; bitmap[4] = 0; bitmap[5] = 0;
        bitmap[6] = 1; bitmap[7] = 1; bitmap[8] = 1;
        bitmap[9] = 0; bitmap[10] = 0; bitmap[11] = 1;
        bitmap[12] = 1; bitmap[13] = 1; bitmap[14] = 1;
        return float(bitmap[index]);
    }
    // 6
    else if (digit == 6) {
        int bitmap[15];
        bitmap[0] = 1; bitmap[1] = 1; bitmap[2] = 1;
        bitmap[3] = 1; bitmap[4] = 0; bitmap[5] = 0;
        bitmap[6] = 1; bitmap[7] = 1; bitmap[8] = 1;
        bitmap[9] = 1; bitmap[10] = 0; bitmap[11] = 1;
        bitmap[12] = 1; bitmap[13] = 1; bitmap[14] = 1;
        return float(bitmap[index]);
    }
    // 7
    else if (digit == 7) {
        int bitmap[15];
        bitmap[0] = 1; bitmap[1] = 1; bitmap[2] = 1;
        bitmap[3] = 0; bitmap[4] = 0; bitmap[5] = 1;
        bitmap[6] = 0; bitmap[7] = 0; bitmap[8] = 1;
        bitmap[9] = 0; bitmap[10] = 0; bitmap[11] = 1;
        bitmap[12] = 0; bitmap[13] = 0; bitmap[14] = 1;
        return float(bitmap[index]);
    }
    // 8
    else if (digit == 8) {
        int bitmap[15];
        bitmap[0] = 1; bitmap[1] = 1; bitmap[2] = 1;
        bitmap[3] = 1; bitmap[4] = 0; bitmap[5] = 1;
        bitmap[6] = 1; bitmap[7] = 1; bitmap[8] = 1;
        bitmap[9] = 1; bitmap[10] = 0; bitmap[11] = 1;
        bitmap[12] = 1; bitmap[13] = 1; bitmap[14] = 1;
        return float(bitmap[index]);
    }
    // 9
    else if (digit == 9) {
        int bitmap[15];
        bitmap[0] = 1; bitmap[1] = 1; bitmap[2] = 1;
        bitmap[3] = 1; bitmap[4] = 0; bitmap[5] = 1;
        bitmap[6] = 1; bitmap[7] = 1; bitmap[8] = 1;
        bitmap[9] = 0; bitmap[10] = 0; bitmap[11] = 1;
        bitmap[12] = 1; bitmap[13] = 1; bitmap[14] = 1;
        return float(bitmap[index]);
    }
    // . (decimal point)
    else if (digit == 10) {
        if (y == 4 && x == 1) return 1.0;
        return 0.0;
    }
    // - (minus sign)
    else if (digit == 11) {
        if (y == 2) return 1.0;
        return 0.0;
    }
    
    return 0.0;
}

vec3 drawFloat_func(vec2 uv, vec2 pos, float value, float size) {
    vec2 relPos = (uv - pos) / size;
    
    // Check if we're in the drawing area
    if (relPos.x < 0.0 || relPos.y < 0.0 || relPos.y >= 5.0) {
        return vec3(0.0);
    }
    
    // Handle negative numbers
    float absValue = abs(value);
    bool isNegative = value < 0.0;
    float charX = relPos.x;
    
    // Draw minus sign for negative numbers
    if (isNegative) {
        if (charX < 3.0) {
            float pixel = getDigitPixel(11, vec2(charX, relPos.y));
            if (pixel > 0.5) return vec3(1.0);
        }
        charX -= 4.0; // Move past minus sign and space
    }
    
    // Extract digits
    float intPart = floor(absValue);
    float fracPart = fract(absValue);
    
    // Determine number of integer digits
    float numDigits = max(1.0, floor(log2(max(intPart, 1.0)) / log2(10.0)) + 1.0);
    
    // Draw integer part
    for (float i = 0.0; i < 6.0; i++) {
        if (i >= numDigits) break;
        
        float digitPos = numDigits - i - 1.0;
        float digitX = charX - digitPos * 4.0;
        
        if (digitX >= 0.0 && digitX < 3.0) {
            float divisor = pow(10.0, i);
            int digit = int(mod(floor(intPart / divisor), 10.0));
            float pixel = getDigitPixel(digit, vec2(digitX, relPos.y));
            if (pixel > 0.5) return vec3(1.0);
        }
    }
    
    // Draw decimal point
    float decimalX = charX - numDigits * 4.0;
    if (decimalX >= 0.0 && decimalX < 3.0) {
        float pixel = getDigitPixel(10, vec2(decimalX, relPos.y));
        if (pixel > 0.5) return vec3(1.0);
    }
    
    // Draw fractional part (2 digits)
    for (float i = 0.0; i < 2.0; i++) {
        float digitX = charX - (numDigits + 1.0 + i) * 4.0;
        
        if (digitX >= 0.0 && digitX < 3.0) {
            fracPart *= 10.0;
            int digit = int(floor(fracPart));
            fracPart = fract(fracPart);
            float pixel = getDigitPixel(digit, vec2(digitX, relPos.y));
            if (pixel > 0.5) return vec3(1.0);
        }
    }
    
    return vec3(0.0);
}`,
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = drawFloat_func(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`,
    },
    webgl2: {
      dependency: `
// Simple 3x5 bitmap font for digits 0-9, decimal point, and minus sign
float getDigitPixel(int digit, vec2 pixelPos) {
    // Each digit is 3 pixels wide, 5 pixels tall
    int x = int(pixelPos.x);
    int y = int(pixelPos.y);
    
    if (x < 0 || x >= 3 || y < 0 || y >= 5) return 0.0;
    
    int index = y * 3 + x;
    
    // Digit bitmaps (1 = pixel on, 0 = pixel off)
    // 0
    if (digit == 0) {
        int bitmap[15];
        bitmap[0] = 1; bitmap[1] = 1; bitmap[2] = 1;
        bitmap[3] = 1; bitmap[4] = 0; bitmap[5] = 1;
        bitmap[6] = 1; bitmap[7] = 0; bitmap[8] = 1;
        bitmap[9] = 1; bitmap[10] = 0; bitmap[11] = 1;
        bitmap[12] = 1; bitmap[13] = 1; bitmap[14] = 1;
        return float(bitmap[index]);
    }
    // 1
    else if (digit == 1) {
        int bitmap[15];
        bitmap[0] = 0; bitmap[1] = 1; bitmap[2] = 0;
        bitmap[3] = 1; bitmap[4] = 1; bitmap[5] = 0;
        bitmap[6] = 0; bitmap[7] = 1; bitmap[8] = 0;
        bitmap[9] = 0; bitmap[10] = 1; bitmap[11] = 0;
        bitmap[12] = 1; bitmap[13] = 1; bitmap[14] = 1;
        return float(bitmap[index]);
    }
    // 2
    else if (digit == 2) {
        int bitmap[15];
        bitmap[0] = 1; bitmap[1] = 1; bitmap[2] = 1;
        bitmap[3] = 0; bitmap[4] = 0; bitmap[5] = 1;
        bitmap[6] = 1; bitmap[7] = 1; bitmap[8] = 1;
        bitmap[9] = 1; bitmap[10] = 0; bitmap[11] = 0;
        bitmap[12] = 1; bitmap[13] = 1; bitmap[14] = 1;
        return float(bitmap[index]);
    }
    // 3
    else if (digit == 3) {
        int bitmap[15];
        bitmap[0] = 1; bitmap[1] = 1; bitmap[2] = 1;
        bitmap[3] = 0; bitmap[4] = 0; bitmap[5] = 1;
        bitmap[6] = 1; bitmap[7] = 1; bitmap[8] = 1;
        bitmap[9] = 0; bitmap[10] = 0; bitmap[11] = 1;
        bitmap[12] = 1; bitmap[13] = 1; bitmap[14] = 1;
        return float(bitmap[index]);
    }
    // 4
    else if (digit == 4) {
        int bitmap[15];
        bitmap[0] = 1; bitmap[1] = 0; bitmap[2] = 1;
        bitmap[3] = 1; bitmap[4] = 0; bitmap[5] = 1;
        bitmap[6] = 1; bitmap[7] = 1; bitmap[8] = 1;
        bitmap[9] = 0; bitmap[10] = 0; bitmap[11] = 1;
        bitmap[12] = 0; bitmap[13] = 0; bitmap[14] = 1;
        return float(bitmap[index]);
    }
    // 5
    else if (digit == 5) {
        int bitmap[15];
        bitmap[0] = 1; bitmap[1] = 1; bitmap[2] = 1;
        bitmap[3] = 1; bitmap[4] = 0; bitmap[5] = 0;
        bitmap[6] = 1; bitmap[7] = 1; bitmap[8] = 1;
        bitmap[9] = 0; bitmap[10] = 0; bitmap[11] = 1;
        bitmap[12] = 1; bitmap[13] = 1; bitmap[14] = 1;
        return float(bitmap[index]);
    }
    // 6
    else if (digit == 6) {
        int bitmap[15];
        bitmap[0] = 1; bitmap[1] = 1; bitmap[2] = 1;
        bitmap[3] = 1; bitmap[4] = 0; bitmap[5] = 0;
        bitmap[6] = 1; bitmap[7] = 1; bitmap[8] = 1;
        bitmap[9] = 1; bitmap[10] = 0; bitmap[11] = 1;
        bitmap[12] = 1; bitmap[13] = 1; bitmap[14] = 1;
        return float(bitmap[index]);
    }
    // 7
    else if (digit == 7) {
        int bitmap[15];
        bitmap[0] = 1; bitmap[1] = 1; bitmap[2] = 1;
        bitmap[3] = 0; bitmap[4] = 0; bitmap[5] = 1;
        bitmap[6] = 0; bitmap[7] = 0; bitmap[8] = 1;
        bitmap[9] = 0; bitmap[10] = 0; bitmap[11] = 1;
        bitmap[12] = 0; bitmap[13] = 0; bitmap[14] = 1;
        return float(bitmap[index]);
    }
    // 8
    else if (digit == 8) {
        int bitmap[15];
        bitmap[0] = 1; bitmap[1] = 1; bitmap[2] = 1;
        bitmap[3] = 1; bitmap[4] = 0; bitmap[5] = 1;
        bitmap[6] = 1; bitmap[7] = 1; bitmap[8] = 1;
        bitmap[9] = 1; bitmap[10] = 0; bitmap[11] = 1;
        bitmap[12] = 1; bitmap[13] = 1; bitmap[14] = 1;
        return float(bitmap[index]);
    }
    // 9
    else if (digit == 9) {
        int bitmap[15];
        bitmap[0] = 1; bitmap[1] = 1; bitmap[2] = 1;
        bitmap[3] = 1; bitmap[4] = 0; bitmap[5] = 1;
        bitmap[6] = 1; bitmap[7] = 1; bitmap[8] = 1;
        bitmap[9] = 0; bitmap[10] = 0; bitmap[11] = 1;
        bitmap[12] = 1; bitmap[13] = 1; bitmap[14] = 1;
        return float(bitmap[index]);
    }
    // . (decimal point)
    else if (digit == 10) {
        if (y == 4 && x == 1) return 1.0;
        return 0.0;
    }
    // - (minus sign)
    else if (digit == 11) {
        if (y == 2) return 1.0;
        return 0.0;
    }
    
    return 0.0;
}

vec3 drawFloat_func(vec2 uv, vec2 pos, float value, float size) {
    vec2 relPos = (uv - pos) / size;
    
    // Check if we're in the drawing area
    if (relPos.x < 0.0 || relPos.y < 0.0 || relPos.y >= 5.0) {
        return vec3(0.0);
    }
    
    // Handle negative numbers
    float absValue = abs(value);
    bool isNegative = value < 0.0;
    float charX = relPos.x;
    
    // Draw minus sign for negative numbers
    if (isNegative) {
        if (charX < 3.0) {
            float pixel = getDigitPixel(11, vec2(charX, relPos.y));
            if (pixel > 0.5) return vec3(1.0);
        }
        charX -= 4.0; // Move past minus sign and space
    }
    
    // Extract digits
    float intPart = floor(absValue);
    float fracPart = fract(absValue);
    
    // Determine number of integer digits
    float numDigits = max(1.0, floor(log2(max(intPart, 1.0)) / log2(10.0)) + 1.0);
    
    // Draw integer part
    for (float i = 0.0; i < 6.0; i++) {
        if (i >= numDigits) break;
        
        float digitPos = numDigits - i - 1.0;
        float digitX = charX - digitPos * 4.0;
        
        if (digitX >= 0.0 && digitX < 3.0) {
            float divisor = pow(10.0, i);
            int digit = int(mod(floor(intPart / divisor), 10.0));
            float pixel = getDigitPixel(digit, vec2(digitX, relPos.y));
            if (pixel > 0.5) return vec3(1.0);
        }
    }
    
    // Draw decimal point
    float decimalX = charX - numDigits * 4.0;
    if (decimalX >= 0.0 && decimalX < 3.0) {
        float pixel = getDigitPixel(10, vec2(decimalX, relPos.y));
        if (pixel > 0.5) return vec3(1.0);
    }
    
    // Draw fractional part (2 digits)
    for (float i = 0.0; i < 2.0; i++) {
        float digitX = charX - (numDigits + 1.0 + i) * 4.0;
        
        if (digitX >= 0.0 && digitX < 3.0) {
            fracPart *= 10.0;
            int digit = int(floor(fracPart));
            fracPart = fract(fracPart);
            float pixel = getDigitPixel(digit, vec2(digitX, relPos.y));
            if (pixel > 0.5) return vec3(1.0);
        }
    }
    
    return vec3(0.0);
}`,
      execution: (inputs, outputs) =>
        `    vec3 ${outputs[0]} = drawFloat_func(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`,
    },
    webgpu: {
      dependency: `
// Simple 3x5 bitmap font for digits 0-9, decimal point, and minus sign
fn getDigitPixel(digit: i32, pixelPos: vec2<f32>) -> f32 {
    let x = i32(pixelPos.x);
    let y = i32(pixelPos.y);
    
    if (x < 0 || x >= 3 || y < 0 || y >= 5) { return 0.0; }
    
    let index = y * 3 + x;
    
    // Digit 0
    if (digit == 0) {
        let bitmap = array<i32, 15>(
            1, 1, 1,
            1, 0, 1,
            1, 0, 1,
            1, 0, 1,
            1, 1, 1
        );
        return f32(bitmap[index]);
    }
    // Digit 1
    else if (digit == 1) {
        let bitmap = array<i32, 15>(
            0, 1, 0,
            1, 1, 0,
            0, 1, 0,
            0, 1, 0,
            1, 1, 1
        );
        return f32(bitmap[index]);
    }
    // Digit 2
    else if (digit == 2) {
        let bitmap = array<i32, 15>(
            1, 1, 1,
            0, 0, 1,
            1, 1, 1,
            1, 0, 0,
            1, 1, 1
        );
        return f32(bitmap[index]);
    }
    // Digit 3
    else if (digit == 3) {
        let bitmap = array<i32, 15>(
            1, 1, 1,
            0, 0, 1,
            1, 1, 1,
            0, 0, 1,
            1, 1, 1
        );
        return f32(bitmap[index]);
    }
    // Digit 4
    else if (digit == 4) {
        let bitmap = array<i32, 15>(
            1, 0, 1,
            1, 0, 1,
            1, 1, 1,
            0, 0, 1,
            0, 0, 1
        );
        return f32(bitmap[index]);
    }
    // Digit 5
    else if (digit == 5) {
        let bitmap = array<i32, 15>(
            1, 1, 1,
            1, 0, 0,
            1, 1, 1,
            0, 0, 1,
            1, 1, 1
        );
        return f32(bitmap[index]);
    }
    // Digit 6
    else if (digit == 6) {
        let bitmap = array<i32, 15>(
            1, 1, 1,
            1, 0, 0,
            1, 1, 1,
            1, 0, 1,
            1, 1, 1
        );
        return f32(bitmap[index]);
    }
    // Digit 7
    else if (digit == 7) {
        let bitmap = array<i32, 15>(
            1, 1, 1,
            0, 0, 1,
            0, 0, 1,
            0, 0, 1,
            0, 0, 1
        );
        return f32(bitmap[index]);
    }
    // Digit 8
    else if (digit == 8) {
        let bitmap = array<i32, 15>(
            1, 1, 1,
            1, 0, 1,
            1, 1, 1,
            1, 0, 1,
            1, 1, 1
        );
        return f32(bitmap[index]);
    }
    // Digit 9
    else if (digit == 9) {
        let bitmap = array<i32, 15>(
            1, 1, 1,
            1, 0, 1,
            1, 1, 1,
            0, 0, 1,
            1, 1, 1
        );
        return f32(bitmap[index]);
    }
    // Decimal point
    else if (digit == 10) {
        if (y == 4 && x == 1) { return 1.0; }
        return 0.0;
    }
    // Minus sign
    else if (digit == 11) {
        if (y == 2) { return 1.0; }
        return 0.0;
    }
    
    return 0.0;
}

fn drawFloat_func(uv: vec2<f32>, pos: vec2<f32>, value: f32, size: f32) -> vec3<f32> {
    let relPos = (uv - pos) / size;
    
    // Check if we're in the drawing area
    if (relPos.x < 0.0 || relPos.y < 0.0 || relPos.y >= 5.0) {
        return vec3<f32>(0.0);
    }
    
    // Handle negative numbers
    let absValue = abs(value);
    let isNegative = value < 0.0;
    var charX = relPos.x;
    
    // Draw minus sign for negative numbers
    if (isNegative) {
        if (charX < 3.0) {
            let pixel = getDigitPixel(11, vec2<f32>(charX, relPos.y));
            if (pixel > 0.5) { return vec3<f32>(1.0); }
        }
        charX = charX - 4.0; // Move past minus sign and space
    }
    
    // Extract digits
    let intPart = floor(absValue);
    var fracPart = fract(absValue);
    
    // Determine number of integer digits
    let numDigits = max(1.0, floor(log2(max(intPart, 1.0)) / log2(10.0)) + 1.0);
    
    // Draw integer part
    for (var i = 0.0; i < 6.0; i = i + 1.0) {
        if (i >= numDigits) { break; }
        
        let digitPos = numDigits - i - 1.0;
        let digitX = charX - digitPos * 4.0;
        
        if (digitX >= 0.0 && digitX < 3.0) {
            let divisor = pow(10.0, i);
            let digit = i32(floor(intPart / divisor) % 10.0);
            let pixel = getDigitPixel(digit, vec2<f32>(digitX, relPos.y));
            if (pixel > 0.5) { return vec3<f32>(1.0); }
        }
    }
    
    // Draw decimal point
    let decimalX = charX - numDigits * 4.0;
    if (decimalX >= 0.0 && decimalX < 3.0) {
        let pixel = getDigitPixel(10, vec2<f32>(decimalX, relPos.y));
        if (pixel > 0.5) { return vec3<f32>(1.0); }
    }
    
    // Draw fractional part (2 digits)
    for (var i = 0.0; i < 2.0; i = i + 1.0) {
        let digitX = charX - (numDigits + 1.0 + i) * 4.0;
        
        if (digitX >= 0.0 && digitX < 3.0) {
            fracPart = fracPart * 10.0;
            let digit = i32(floor(fracPart));
            fracPart = fract(fracPart);
            let pixel = getDigitPixel(digit, vec2<f32>(digitX, relPos.y));
            if (pixel > 0.5) { return vec3<f32>(1.0); }
        }
    }
    
    return vec3<f32>(0.0);
}`,
      execution: (inputs, outputs) =>
        `    var ${outputs[0]}: vec3<f32> = drawFloat_func(${inputs[0]}, ${inputs[1]}, ${inputs[2]}, ${inputs[3]});`,
    },
  },
  "Debug",
  ["draw", "float", "text", "debug", "display", "number"]
);
