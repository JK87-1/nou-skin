/**
 * LandmarkRegions — Convert 468 MediaPipe Face Mesh landmarks to
 * 27 analysis-region bounding boxes matching PixelAnalysis.js region names.
 *
 * Landmark indices reference:
 *   https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model_uv_visualization.png
 *
 * Each region is defined by a set of landmark indices. The bounding box
 * is computed from the min/max x,y of those landmarks, scaled to canvas
 * pixel coordinates (W, H).
 */

// ── Landmark index groups for each analysis region ──

// Base 5 regions
const FOREHEAD        = [10, 67, 69, 104, 108, 109, 151, 297, 299, 333, 337, 338];
const NOSE            = [1, 2, 4, 5, 6, 19, 44, 45, 49, 64, 94, 122, 168, 195, 196, 197, 236, 274, 275, 279, 294, 351, 456];
const LEFT_CHEEK      = [36, 47, 50, 101, 116, 117, 118, 123, 132, 147, 187, 192, 205, 206, 207, 213];
const RIGHT_CHEEK     = [266, 277, 280, 330, 345, 346, 347, 352, 361, 376, 411, 416, 425, 426, 427, 433];
const CHIN            = [17, 18, 83, 84, 169, 170, 175, 176, 194, 199, 200, 313, 314, 394, 395, 400, 401, 418];

// Wrinkle zones
const FOREHEAD_WRINKLE = [10, 21, 54, 67, 69, 103, 104, 108, 109, 151, 251, 284, 297, 299, 332, 333, 337, 338];
const LEFT_CROWS_FEET  = [33, 130, 133, 155, 157, 158, 159, 160, 161, 173, 226, 246];
const RIGHT_CROWS_FEET = [263, 359, 362, 382, 384, 385, 386, 387, 388, 398, 446, 466];
const NASOLABIAL_LEFT  = [36, 47, 50, 64, 83, 101, 106, 182, 202, 204, 212];
const NASOLABIAL_RIGHT = [266, 277, 280, 294, 313, 330, 335, 406, 422, 424, 432];

// Pore zones
const NOSE_WING         = [1, 2, 4, 5, 6, 19, 48, 49, 64, 94, 97, 98, 168, 195, 196, 236, 278, 279, 294, 326, 327];
const LEFT_INNER_CHEEK  = [36, 47, 50, 101, 116, 117, 118, 123, 147, 192, 205, 206];
const RIGHT_INNER_CHEEK = [266, 277, 280, 330, 345, 346, 347, 352, 376, 416, 425, 426];

// Elasticity zones (jawline)
const JAWLINE_LEFT    = [58, 132, 136, 150, 152, 169, 170, 171, 172, 176, 194, 199, 200, 208, 211];
const JAWLINE_RIGHT   = [288, 361, 365, 379, 381, 394, 395, 396, 397, 401, 418, 428, 431];
const JAWLINE_CENTER  = [17, 18, 152, 175, 176, 194, 199, 200, 377, 400, 401, 418];

// Pigmentation zones
const LEFT_UPPER_CHEEK  = [36, 47, 50, 101, 116, 117, 118, 123, 132, 137, 192, 213];
const RIGHT_UPPER_CHEEK = [266, 277, 280, 330, 345, 346, 347, 352, 361, 366, 416, 433];
const FOREHEAD_SIDE     = [10, 21, 54, 67, 69, 103, 104, 108, 109, 151, 162, 234, 251, 284, 297, 299, 332, 333, 337, 338, 389, 454];

// Texture zones (broad cheek)
const LEFT_CHEEK_BROAD  = [36, 47, 50, 58, 101, 116, 117, 118, 123, 132, 147, 150, 172, 187, 192, 205, 206, 207, 213];
const RIGHT_CHEEK_BROAD = [266, 277, 280, 288, 330, 345, 346, 347, 352, 361, 376, 379, 397, 411, 416, 425, 426, 427, 433];
const FOREHEAD_BROAD    = [10, 21, 54, 67, 69, 103, 104, 108, 109, 151, 162, 234, 251, 284, 297, 299, 332, 333, 337, 338, 389, 454];

// Dark circle zones (under-eye)
const LEFT_UNDER_EYE   = [33, 7, 112, 113, 114, 130, 133, 155, 156, 157, 158, 173, 226];
const RIGHT_UNDER_EYE  = [263, 249, 341, 342, 343, 359, 362, 382, 383, 384, 385, 398, 446];
const LEFT_MID_CHEEK   = [36, 47, 50, 101, 116, 117, 118, 123, 187, 192, 205];
const RIGHT_MID_CHEEK  = [266, 277, 280, 330, 345, 346, 347, 352, 411, 416, 425];

// ── All region definitions ──
const REGION_DEFS = {
  forehead:         FOREHEAD,
  nose:             NOSE,
  leftCheek:        LEFT_CHEEK,
  rightCheek:       RIGHT_CHEEK,
  chin:             CHIN,

  foreheadWrinkle:  FOREHEAD_WRINKLE,
  leftCrowsFeet:    LEFT_CROWS_FEET,
  rightCrowsFeet:   RIGHT_CROWS_FEET,
  nasolabialLeft:   NASOLABIAL_LEFT,
  nasolabialRight:  NASOLABIAL_RIGHT,

  noseWing:         NOSE_WING,
  leftInnerCheek:   LEFT_INNER_CHEEK,
  rightInnerCheek:  RIGHT_INNER_CHEEK,

  jawlineLeft:      JAWLINE_LEFT,
  jawlineRight:     JAWLINE_RIGHT,
  jawlineCenter:    JAWLINE_CENTER,

  leftUpperCheek:   LEFT_UPPER_CHEEK,
  rightUpperCheek:  RIGHT_UPPER_CHEEK,
  foreheadSide:     FOREHEAD_SIDE,

  leftCheekBroad:   LEFT_CHEEK_BROAD,
  rightCheekBroad:  RIGHT_CHEEK_BROAD,
  foreheadBroad:    FOREHEAD_BROAD,

  leftUnderEye:     LEFT_UNDER_EYE,
  rightUnderEye:    RIGHT_UNDER_EYE,
  leftMidCheek:     LEFT_MID_CHEEK,
  rightMidCheek:    RIGHT_MID_CHEEK,
};

/**
 * Convert MediaPipe normalized landmarks to pixel-coordinate bounding boxes.
 *
 * @param {Array<{x:number, y:number}>} landmarks  468 normalized (0-1) landmarks
 * @param {number} W  Canvas width in pixels
 * @param {number} H  Canvas height in pixels
 * @param {number} [pad=0.08]  Fractional padding added around each bbox
 * @returns {Object<string, {x1:number, y1:number, x2:number, y2:number}>}
 */
export function landmarksToRegions(landmarks, W, H, pad = 0.08) {
  const regions = {};

  for (const [name, indices] of Object.entries(REGION_DEFS)) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const idx of indices) {
      const lm = landmarks[idx];
      if (!lm) continue;
      const px = lm.x * W;
      const py = lm.y * H;
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }

    if (minX === Infinity) continue; // no valid landmarks for this region

    // Add padding
    const bw = maxX - minX;
    const bh = maxY - minY;
    regions[name] = {
      x1: Math.max(0, minX - bw * pad),
      y1: Math.max(0, minY - bh * pad),
      x2: Math.min(W, maxX + bw * pad),
      y2: Math.min(H, maxY + bh * pad),
    };
  }

  return regions;
}
