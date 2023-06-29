import {data20230729, PollReportData, PollReportOptionData} from "@patient-nz/medical-cannabis-data/social-media/reddit/polls";
import {mean} from "simple-statistics";
import {ok} from "./is";

const DEFAULT_POLLS = data20230729;

export type Selections = Map<PollReportData, PollReportOptionData>;

function isNumberString(value?: string | number): value is `${number}` | number {
    if (typeof value === "number") return true;
    return (
        typeof value === "string" &&
        /^\d+(?:\.\d+)?$/.test(value)
    );
}

function isNumberOrDollarString(value?: string | number): value is `${number}` | `$${number}` | number {
    return (
        isNumberString(value) ||
        (
            typeof value === "string" &&
            /^\$\d+(?:\.\d+)?$/.test(value)
        )
    )
}

function getNumber(value?: string | number): number {
    if (typeof value === "number") {
        return value;
    }

    if (typeof value !== "string") {
        return NaN;
    }

    if (value.startsWith("$")) {
        return getNumber(value.substring(1));
    }

    return +value;
}

function isNumericPoll(poll: PollReportData) {
    return poll.options.find(option => (
        (
            option.value &&
            isNumberOrDollarString(option.value)
        ) ||
        (
            option.range &&
            option.range.length &&
            option.range.every(isNumberOrDollarString)
        )
    ))
}

export function getHighestVotedProfile(polls = DEFAULT_POLLS): Selections {
    return new Map(
        polls.map(
            poll => [
                poll,
                getHighestVoted(poll)
            ] as const
        )
    )

    function getHighestVoted(poll: PollReportData): PollReportOptionData {
        const votes = poll.options.map(option => +option.votes);
        const max = Math.max(...votes);
        const index = votes.indexOf(max);
        const lastIndex = votes.lastIndexOf(max);
        if (lastIndex !== index) {
            if (Math.random() > 0.5) {
                return poll.options[lastIndex];
            }
        }
        return poll.options[index];
    }
}

function getFlatNumericValues(option: PollReportOptionData): number[] {
    const value = getNumericValue(option);
    return Array.from({ length: +option.votes }, () => {
        return value;
    })
}


function getNumericValue(option: PollReportOptionData): number {
    let value = getNumber(option.value);
    if (option.range && option.range.length && option.range.every(isNumberOrDollarString)) {
        const values = option.range.map(value => getNumber(value));
        const sum = values.reduce(
            (sum, value) => sum + value,
            0
        );
        value = (sum / values.length);
    }
    return value
}

export function getAverageProfile(polls = DEFAULT_POLLS): Selections {
    const highestVoted = getHighestVotedProfile(polls);
    return new Map(
        polls.map(
            poll => [
                poll,
                getAverage(poll)
            ] as const
        )
    )

    function getAverage(poll: PollReportData): PollReportOptionData {
        if (!isNumericPoll(poll)) {
            return highestVoted.get(poll);
        }
        const optionValues = poll.options.map(getFlatNumericValues);
        const values = optionValues.flatMap(value => value);
        const value = mean(values);

        const optionDistance = poll.options.map(option => {
            const optionValue = getNumericValue(option);
            return Math.abs(
                value - optionValue
            );
        });
        const smallestDistance = Math.min(...optionDistance);
        const matchingOptionIndex = optionDistance.indexOf(smallestDistance);
        const matchingOptionLastIndex = optionDistance.lastIndexOf(smallestDistance);

        // Average should be within the options...
        ok(matchingOptionIndex !== -1);

        let matchingOption = poll.options[matchingOptionIndex];

        if (matchingOptionLastIndex && (matchingOption.votes < poll.options[matchingOptionLastIndex].votes)) {
            matchingOption = poll.options[matchingOptionLastIndex];
        }

        return {
            ...matchingOption,
            value: (Math.round(value * 100) / 100).toString()
        };
    }
}

export function getTotalVotes(poll: PollReportData) {
    return poll.options.reduce(
        (sum, option) => sum + (+(option.votes ?? 0)),
        0
    )
}

export function createMarkdownProfile(profile: Selections): string {
    const licenses = new Map([...profile.keys()].map(poll => [poll.license, poll.licenseName]));
    const licenseUrls = [...licenses.keys()];
    const licenseUrlString = licenseUrls.map(url => `[${licenses.get(url)}](${url})`).join(", ");
    const authors = [...new Set([...profile.keys()].map(poll => poll.author))]

    const selections = [...profile.keys()].map(poll => {
        const option = profile.get(poll);
        return `| ${poll.title} | ${option.title} | ${typeof option.value === "string" ? option.value : option.title } | ${getTotalVotes(poll)} |`
    }).join("\n")

    return `
| Question | Title      | Value      | n |
|----------|------------|------------|---|
${selections}

This data is generated using work published as ${licenseUrlString} authored by:

${authors.map(value => `- ${value}`).join("\n")}
`
}