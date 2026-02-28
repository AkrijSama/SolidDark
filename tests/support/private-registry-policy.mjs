export const registryIssuancePolicy = {
  async beforeIssue({ payload }) {
    if (payload.unknowns_count > 2) {
      return {
        status: "ok",
        allow: false,
        notes: ["Passports with more than two unknowns require managed review."],
      };
    }

    return {
      status: "ok",
      allow: true,
      notes: ["Private issuance policy approved the passport."],
    };
  },
};
