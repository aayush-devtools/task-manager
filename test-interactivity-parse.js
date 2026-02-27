const testBody = "team_id=T0AHYV7J1S5&command=%2Ftask";
const params = new URLSearchParams(testBody);
console.log("Team ID parser result:", params.get("team_id"));
