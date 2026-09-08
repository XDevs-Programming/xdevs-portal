function errorHandler(error, req, res, next) {
  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  const status = Number(error.status || error.statusCode) || 500;

  res.status(status).json({
    success: false,
    message:
      status >= 500
        ? "An unexpected server error occurred."
        : error.message
  });
}

module.exports = errorHandler;
