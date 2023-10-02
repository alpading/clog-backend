
const router = require("express").Router();
const pool = require("../../config/database/postgresql");
const validate = require('../module/validation');
const mapping = require("../module/mapping");
const loginAuth = require("../middleware/loginAuth");
const managerAuth = require("../middleware/managerAuth");
const { BadRequestException } = require('../module/customError');
const { club } = require("../module/global");
const { position } = require("../module/global");

// 동아리 생성 api
router.post("/", loginAuth, async (req, res, next) => {
    const result = {
        message: "",
        data: {}
    }
    const {
        name, belong, bigCategory, smallCategory, cover, isAllowJoin, themeColor, bannerImg, profileImg
    } = req.body;
    const userId = req.decoded.id;
    let pgClient = null;

    try {
        validate(name, "name").checkInput().checkClubNameRegex();
        validate(cover, "cover").checkInput().checkLength(1, club.maxClubCoverLength);
        validate(isAllowJoin, "isAllowJoin").checkInput().isBoolean();
        validate(themeColor, "themeColor").checkInput().checkThemeColorRegex();
        validate(belong, "belong").checkInput().isNumber().checkLength(1, club.maxClubBelongLength);
        validate(bigCategory, "bigCategory").checkInput().isNumber().checkLength(1, club.maxClubBigCategoryLength);
        validate(smallCategory, "smallCategory").checkInput().isNumber().checkLength(1, club.maxClubSmallCategoryLength);

        // 받아온 데이터 (소속, 대분류, 소분류) 매핑
        const convertedBelong = mapping.getBelong(belong);
        const convertedBigCategory = mapping.getBigCategory(bigCategory);
        const convertedSmallCategory = mapping.getSmallCategory(smallCategory);

        pgClient = await pool.connect();
        // 트랜잭션 시작
        await pgClient.query("BEGIN");

        const insertClubQuery = `INSERT INTO 
                                            club_tb (name, cover, is_recruit, profile_img, banner_img, theme_color)
                                 VALUES 
                                            ($1, $2, $3, $4, $5, $6) 
                                 RETURNING 
                                            id`;

        const insertBelongQuery = `INSERT INTO 
                                            belong_tb (club_id, name)
                                   VALUES 
                                            ($1, $2)`;

        const insertBigCategoryQuery = `INSERT INTO 
                                                big_category_tb (club_id, name)
                                        VALUES 
                                               ($1, $2)`;

        const insertSmallCategoryQuery = `INSERT INTO 
                                                small_category_tb (club_id, name)
                                          VALUES 
                                                ($1, $2)`;

        const insertClubOwnerQuery = `INSERT INTO 
                                            club_member_tb (account_id, club_id, position)
                                      VALUES 
                                            ($1, $2, $3)`;

        const insertClubParam = [name, cover, isAllowJoin, profileImg, bannerImg, themeColor];
        const insertClubData = await pgClient.query(insertClubQuery, insertClubParam);
        const createdClubId = insertClubData.rows[0].id;

        const insertBelongParam = [createdClubId, convertedBelong];
        await pgClient.query(insertBelongQuery, insertBelongParam);

        const insertBigCategoryParam = [createdClubId, convertedBigCategory];
        await pgClient.query(insertBigCategoryQuery, insertBigCategoryParam);

        const insertSmallCategoryParam = [createdClubId, convertedSmallCategory];
        await pgClient.query(insertSmallCategoryQuery, insertSmallCategoryParam);

        const insertClubOwnerParams = [userId, createdClubId, position.president];
        await pgClient.query(insertClubOwnerQuery, insertClubOwnerParams);

        // 트랜잭션 커밋
        await pgClient.query("COMMIT");

        result.message = "동아리 생성 성공";
        result.data = {
            "clubId": createdClubId
        }
        return res.send(result);

    } catch (error) {
        if (pgClient) {
            await pgClient.query("ROLLBACK");
        }
        next(error);

    } finally {
        if (pgClient) {
            pgClient.release();
        }
    }
});

// 동아리 프로필 조회 api
router.get("/:clubId/profile", async (req, res, next) => {
    const { clubId } = req.params;
    const result = {
        message: "",
        data: {}
    }
    try {
        validate(clubId, "clubId").checkInput().isNumber().checkLength(1, 5);

        const selectedClubSql = `SELECT 
                                        club_tb.name AS name, 
                                        belong_tb.name AS belong, 
                                        big_category_tb.name AS bigCategory, 
                                        small_category_tb.name AS smallCategory, 
                                        club_tb.profile_img AS profileImage, 
                                        club_tb.cover AS cover, 
                                        club_tb.created_at AS createdAt
                                 FROM 
                                        club_tb
                                 JOIN 
                                        belong_tb ON club_tb.id = belong_tb.club_id
                                 JOIN   
                                        big_category_tb ON club_tb.id = big_category_tb.club_id
                                 JOIN   
                                        small_category_tb ON club_tb.id = small_category_tb.club_id
                                 WHERE 
                                        club_tb.id = $1`
        const selectedClubParams = [clubId];

        const clubProfiledata = await pool.query(selectedClubSql, selectedClubParams);
        if (clubProfiledata.rowCount === 0) {
            throw new BadRequestException("해당하는 동아리가 존재하지 않습니다");
        }
        result.data = {
            club: clubProfiledata.rows
        }
        return res.send(result);

    } catch (error) {
        next(error);
    }
});

// 동아리 관리자 페이지 (동아리 프로필)api
router.get("/:clubId/manage", loginAuth, managerAuth, async (req, res, next) => {
});

// 동아리 수정 api
router.put("/", loginAuth, managerAuth, async (req, res, next) => {
    const {
        name, cover, isAllowJoin, themeColor, bannerImg, profileImg
    } = req.body;
    const { clubId } = req.body;
    const result = {
        message: "",
        data: {}
    };

    try {
        validate(name, "name").checkInput().checkClubNameRegex();
        validate(cover, "cover").checkInput().checkLength(1, maxClubCoverLength);
        validate(isAllowJoin, "isAllowJoin").checkInput().isBoolean();
        validate(themeColor, "themeColor").checkInput().checkThemeColorRegex();
        validate(bannerImg, "bannerImg").checkInput().checkLength(1, maxBannerImageLength);
        validate(profileImg, "profileImg").checkInput().checkLength(1, maxProfileImageLength);

        const modifyClubProfileSql = `UPDATE 
                                            club_tb
                                      SET 
                                            name = $1, 
                                            cover = $2, 
                                            is_recruit = $3, 
                                            theme_color = $4, 
                                            banner_img = $5, 
                                            profile_img = $6 
                                      WHERE 
                                            id = $7`;
        const modifyClubProfileParam = [
            name, cover, isAllowJoin, themeColor, bannerImg, profileImg,
            clubId
        ];
        const modifyClubProfileData = await pool.query(modifyClubProfileSql, modifyClubProfileParam);
        if (modifyClubProfileData.rowCount !== 0) {
            result.message = "수정 성공";
            return res.send(result);
        }

    } catch (error) {
        next(error);
    }
});

// 동아리 공지 게시물 불러오는 api
router.get("/:clubId/notice/list", loginAuth, async (req, res, next) => {
    const result = {
        message: "",
        data: {}
    };
    const { clubId } = req.params;
    const { page } = req.query;

    try {
        validate(clubId, "clubId").checkInput().isNumber().checkLength(1, 5);
        validate(page, "page").isNumber().checkLength(1, 5);

        const offset = (page - 1) * club.maxPostCountPerPage;
        const selectNoticeAllCountSql = `SELECT
                                                count(*)::int
                                          FROM
                                                notice_post_tb`;

        const selectNoticePostSql = `SELECT 
                                            notice_post_tb.id,
                                            notice_post_tb.title, 
                                            notice_post_tb.content, 
                                            notice_post_tb.is_fixed AS isFixed, 
                                            TO_CHAR(notice_post_tb.created_at, 'YYYY-MM-DD') AS createdAt, 
                                            account_tb.name AS authorName,
                                            account_tb.personal_color AS authorPcolor
                                     FROM 
                                            notice_post_tb
                                     JOIN 
                                            account_tb ON notice_post_tb.account_id = account_tb.id
                                     WHERE 
                                            club_id = $1
                                     ORDER BY 
                                            notice_post_tb.created_at DESC 
                                     OFFSET 
                                            $2 
                                     LIMIT 
                                            $3`;
        const selectNoticePostParam = [clubId, offset, club.maxPostCountPerPage];
        const noticeAllCountData = await pool.query(selectNoticeAllCountSql);
        const noticePostData = await pool.query(selectNoticePostSql, selectNoticePostParam);
        if (noticePostData.rowCount !== 0) {
            result.data = {
                count: noticeAllCountData.rows[0].count,
                notice: noticePostData.rows
            }
            return res.send(result);
        }
        throw new BadRequestException("해당하는 동아리에 공지글이 존재하지 않습니다");

    } catch (error) {
        next(error);
    }
});

// 고정 공지 게시물 불러오는 api
router.get("/:clubId/notice/fixed", loginAuth, async (req, res, next) => {
    const result = {
        message: "",
        data: {}
    }
    const { clubId } = req.params;

    try {
        const selectedFixedNoticeSql = `SELECT
                                                notice_post_tb.id,
                                                notice_post_tb.title,
                                                notice_post_tb.created_at AS createdAt,
                                                account_tb.personal_color AS authorPcolor,
                                                account_tb.name AS authorName
                                        FROM 
                                                notice_post_tb
                                        JOIN
                                                account_tb ON notice_post_tb.account_id = account_tb.id
                                        WHERE
                                                is_fixed = true
                                        AND
                                                club_id = $1
                                        LIMIT
                                                $2`;
        const selectedFixedNoticeParam = [clubId, club.maxFixedNoticeCountPerPage];

        const data = await pool.query(selectedFixedNoticeSql, selectedFixedNoticeParam);
        if (data.rowCount !== 0) {
            result.data = {
                notice: data.rows
            }
            return res.send(result);
        }
        throw new BadRequestException("고정 공지 게시글이 존재하지 않습니다");

    } catch (error) {
        next(error);
    }
});

module.exports = router;