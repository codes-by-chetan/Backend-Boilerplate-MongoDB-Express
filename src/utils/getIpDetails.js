const getIpDetails = (req) => {
    return {
        clientIp:
            req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
            req.headers["x-real-ip"] ||
            req.headers["x-client-ip"] ||
            req.socket.remoteAddress ||
            req.ip, // Best guess for real client IP
        xForwardedFor: req.headers["x-forwarded-for"] || "",
        xRealIp: req.headers["x-real-ip"] || "",
        xClientIp: req.headers["x-client-ip"] || "",
        remoteAddress: req.socket.remoteAddress || "",
        reqIP: req.ip,
    };
};

export default getIpDetails;
