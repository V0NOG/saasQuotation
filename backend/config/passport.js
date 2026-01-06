const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const Org = require("../models/Org");
const User = require("../models/User");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const googleSub = profile.id;
        const email = (profile.emails?.[0]?.value || "").toLowerCase();
        const firstName = profile.name?.givenName || "";
        const lastName = profile.name?.familyName || "";

        // 1) Try find existing user by google sub
        let user = await User.findOne({ "google.sub": googleSub });

        // 2) If not found, try find user by email (any org) and attach google
        // You can tighten this logic later (invite-only orgs, etc.)
        if (!user && email) {
          user = await User.findOne({ email });
        }

        // 3) If still not found, create a new Org + User (owner)
        if (!user) {
          const org = await Org.create({
            name: `${firstName || "New"} ${lastName || "Company"}`
          });

          user = await User.create({
            orgId: org._id,
            firstName,
            lastName,
            email,
            role: "owner",
            google: { sub: googleSub, email }
          });
        } else {
          // ensure google data is attached
          user.google = { sub: googleSub, email };
          if (!user.firstName) user.firstName = firstName;
          if (!user.lastName) user.lastName = lastName;
          await user.save();
        }

        return done(null, user);
      } catch (e) {
        return done(e);
      }
    }
  )
);

module.exports = passport;