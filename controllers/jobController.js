const conversionJobRepository = require("../repositories/conversionJobRepository");

const getUserConversionJobs = async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.isAdmin;

    // Parse pagination query params, with defaults
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10; // Set a default limit

    let data;
    if (isAdmin) {
      data = await conversionJobRepository.getPaginatedAllJobs(page, limit);
    } else {
      data = await conversionJobRepository.getPaginatedJobsByUserId(
        userId,
        page,
        limit
      );
    }

    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching conversion jobs:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor al obtener el historial." });
  }
};

module.exports = {
  getUserConversionJobs,
};
