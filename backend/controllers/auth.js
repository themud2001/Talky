const jwt = require("jsonwebtoken");

const User = require("../models/User");

exports.refreshToken = async (req, res) => {
    if (!req.cookies || !req.cookies.__refresh_token) return res.status(401).end();

    try {
        const payload = jwt.verify(req.cookies.__refresh_token, process.env.JWT_SECRET);
        const user = await User.findById(payload.sub);

        if (!user) return res.status(401).end();
        return res.status(200).json({ token: user.getAccessToken(), user: user.omitPassword() });
    } catch (err) {
        return res.status(401).end();
    }
};

exports.signIn = async (req, res, next) => {
    const { email, password } = req.body;

    if (
        !email ||
        !password ||
        email.trim() === "" ||
        password.trim() === ""
    ) {
        return res.status(400).json({ errorMessage: "Invalid credentials" });
    }

    try {
        const user = await User.findOne({ email });

        if (!user) return res.status(400).json({ errorMessage: "User does not exist" });

        const isMatch = await user.comparePassword(password);

        if (!isMatch) return res.status(400).json({ errorMessage: "Invalid credentials" });

        const accessToken = user.getAccessToken();
        const refreshToken = user.getRefreshToken();
        const cookieOptions = {
            httpOnly: true,
            expires: new Date(
                Date.now() + process.env.JWT_REFRESH_TOKEN_EXPIRY * 24 * 60 * 60 * 1000
            )
        };

        return res.status(200)
            .cookie("__refresh_token", refreshToken, cookieOptions)
            .json({ token: accessToken, user: user.omitPassword() });
    } catch (err) {
        return next(err);
    }
};

exports.signUp = async (req, res, next) => {
    const { username, email, password } = req.body;

    try {
        await User.validate({ username, email, password }, ["username", "email", "password"]);
    } catch (err) {
        return res.status(400).json({ errorMessage: err.errors });
    }

    try {
        let user = await User.findOne({
            $or: [
                { username: { $regex: `^${username}$`, $options: "i" } },
                { email }
            ]
        });

        if (user) return res.status(400).json({ errorMessage: "User already exists" });

        user = await User.create({ username, email, password });
        const accessToken = user.getAccessToken();
        const refreshToken = user.getRefreshToken();
        const cookieOptions = {
            httpOnly: true,
            expires: new Date(
                Date.now() + process.env.JWT_REFRESH_TOKEN_EXPIRY * 24 * 60 * 60 * 1000
            )
        };
        
        return res.status(201)
            .cookie("__refresh_token", refreshToken, cookieOptions)
            .json({ token: accessToken, user: user.omitPassword() });
    } catch (err) {
        return next(err);
    }
};