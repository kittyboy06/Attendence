
/**
 * Compares two signature images and returns a similarity score (0 to 1).
 * Checks the signature in 4 orientations (0, 90, 180, 270 degrees) to allow for rotated signing.
 * @param {string} url1 - URL of the reference image.
 * @param {string} dataUrl2 - Base64 Data URL of the new signature.
 * @returns {Promise<number>} - Best similarity score (0.0 to 1.0) found among all rotations.
 */
export const compareSignatures = async (url1, dataUrl2) => {
    try {
        const img1 = await loadImage(url1); // Reference
        const img2 = await loadImage(dataUrl2); // Input

        const width = 300; // Standardize width
        const height = 150; // Standardize height

        // Get pixel data for Reference (img1) - Fixed Orientation
        const data1 = getImageData(img1, width, height);

        // Check all 4 rotations for Input (img2) and find best match
        const scores = [
            compareData(data1, getImageData(img2, width, height, 0), width, height),    // 0 deg
            compareData(data1, getImageData(img2, width, height, 90), width, height),   // 90 deg
            compareData(data1, getImageData(img2, width, height, 180), width, height),  // 180 deg
            compareData(data1, getImageData(img2, width, height, 270), width, height)   // 270 deg
        ];

        // Return the highest similarity score
        return Math.max(...scores);

    } catch (error) {
        console.error("Signature comparison error:", error);
        return 0;
    }
};

const loadImage = (src) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
        img.src = src;
    });
};

/**
 * Gets pixel data from an image drawn on a canvas with specific rotation.
 */
const getImageData = (img, width, height, rotationDeg = 0) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    ctx.save();
    // Move to center
    ctx.translate(width / 2, height / 2);
    // Rotate
    ctx.rotate((rotationDeg * Math.PI) / 180);

    // Draw image centered. 
    // If rotated 90/270, we might need to swap scaling or draw logic if aspect ratio differs rigorously, 
    // but for simple signature box matching, fitting it into the same box is usually checking "shape".
    // Actually, simply drawing it rotated might crop it if square vs rectangle.
    // Let's assume the signature content is roughly centered.
    if (rotationDeg === 90 || rotationDeg === 270) {
        // Fit height to width and width to height? or just draw?
        // Let's just draw with same dimensions centered. Content might scale.
        ctx.drawImage(img, -height / 2, -width / 2, height, width);
    } else {
        ctx.drawImage(img, -width / 2, -height / 2, width, height);
    }

    ctx.restore();

    return ctx.getImageData(0, 0, width, height).data;
};

/**
 * Compare two pixel data arrays using stroke overlap matching with tolerance.
 */
const compareData = (data1, data2, width, height) => {
    let matchingPixels = 0;
    let totalSignificantPixels = 0;

    for (let i = 0; i < data1.length; i += 4) {
        const alpha1 = data1[i + 3];
        const alpha2 = data2[i + 3];

        const hasStroke1 = alpha1 > 50;
        const hasStroke2 = alpha2 > 50;

        if (hasStroke1 || hasStroke2) {
            totalSignificantPixels++;
            if (hasStroke1 && hasStroke2) {
                matchingPixels++;
            } else if (hasStroke1) {
                // Check neighbors in data2 (tolerance)
                if (checkNeighbors(data2, i, width)) matchingPixels++;
            } else if (hasStroke2) {
                // Check neighbors in data1 (tolerance)
                if (checkNeighbors(data1, i, width)) matchingPixels++;
            }
        }
    }

    if (totalSignificantPixels === 0) return 0;
    return matchingPixels / totalSignificantPixels;
};

const checkNeighbors = (data, idx, width) => {
    // Neighbor offsets: -4 (left), +4 (right), -4*width (up), +4*width (down)
    const offsets = [-4, 4, -width * 4, width * 4];
    for (let o of offsets) {
        if (data[idx + o + 3] > 50) return true;
    }
    return false;
};
