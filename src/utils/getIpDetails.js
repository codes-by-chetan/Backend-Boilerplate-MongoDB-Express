const getIpDetails = (req) => {
    if (!req) return { clientIp: null };
    const headers = req.headers || {};
    return {
        clientIp:
            headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
            headers["x-real-ip"] ||
            headers["x-client-ip"] ||
            req.socket?.remoteAddress ||
            req.ip ||
            null,
        xForwardedFor: headers["x-forwarded-for"] || "",
        xRealIp: headers["x-real-ip"] || "",
        xClientIp: headers["x-client-ip"] || "",
        remoteAddress: req.socket?.remoteAddress || "",
        reqIP: req.ip,
    };
};

export default getIpDetails;
