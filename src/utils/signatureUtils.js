
/**
 * Compares two signature images and returns a similarity score (0 to 1).
 * @param {string} url1 - URL of the reference image.
 * @param {string} dataUrl2 - Base64 Data URL of the new signature.
 * @returns {Promise<number>} - Similarity score (0.0 to 1.0).
 */
export const compareSignatures = async (url1, dataUrl2) => {
    try {
        const img1 = await loadImage(url1);
        const img2 = await loadImage(dataUrl2);

        const width = 300; // Standardize width
        const height = 150; // Standardize height

        const canvas1 = document.createElement('canvas');
        const canvas2 = document.createElement('canvas');
        canvas1.width = width;
        canvas1.height = height;
        canvas2.width = width;
        canvas2.height = height;

        const ctx1 = canvas1.getContext('2d');
        const ctx2 = canvas2.getContext('2d');

        // Draw images ensuring they cover the canvas or center them
        ctx1.drawImage(img1, 0, 0, width, height);
        ctx2.drawImage(img2, 0, 0, width, height);

        const data1 = ctx1.getImageData(0, 0, width, height).data;
        const data2 = ctx2.getImageData(0, 0, width, height).data;

        let matchingPixels = 0;
        let totalSignificantPixels = 0;

        // Simple pixel overlap comparison
        // We look for non-transparent pixels (alpha > 0)
        for (let i = 0; i < data1.length; i += 4) {
            const alpha1 = data1[i + 3];
            const alpha2 = data2[i + 3];

            const hasStroke1 = alpha1 > 50;
            const hasStroke2 = alpha2 > 50;

            if (hasStroke1 || hasStroke2) {
                totalSignificantPixels++;
                // If both have strokes at this position, it's a match
                // We can also allow some spatial tolerance (e.g. adjacent pixels), but straight overlap is a good baseline
                // For "similar", we might want simple intersection over union (IoU)
                if (hasStroke1 && hasStroke2) {
                    matchingPixels++;
                }
            }
        }

        if (totalSignificantPixels === 0) return 0; // Both empty

        // IoU (Intersection over Union) Score
        // But since signatures can be slightly offset, strict pixel matching might differ.
        // Let's rely on a simpler "overlap ratio" for now.
        // If 30-40% of the combined strokes overlap, it's usually the same shape roughly drawn.
        // Signatures are tricky for exact pixel match.

        return matchingPixels / totalSignificantPixels;
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
