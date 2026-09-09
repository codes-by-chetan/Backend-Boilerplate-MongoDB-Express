import os from "os";

const getHostIpAddress = () => {
    const networkInterfaces = os.networkInterfaces();

    for (const interfaceName in networkInterfaces){
        for(const net of networkInterfaces[interfaceName]){
            if(net.family === "IPv4" && !net.internal){
                return net.address
            }
        }
    }

    return "localhost";
}

export default getHostIpAddress