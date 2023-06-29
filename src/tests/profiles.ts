import {createMarkdownProfile, getAverageProfile, getHighestVotedProfile} from "../profiles";

console.log("## Highest voted profile:\n");
console.log(createMarkdownProfile(getHighestVotedProfile()));
console.log("\n## Average profile:\n");
console.log(createMarkdownProfile(getAverageProfile()));
