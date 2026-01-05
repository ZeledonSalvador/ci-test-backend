interface StatusResponse {
    id : number,
    status: string;
    observation?: string | string[] | Record<string, string>[];
    time : string; 
    date : string;
    createdAt: Date;
}
