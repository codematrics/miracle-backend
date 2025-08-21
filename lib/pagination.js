const paginate = async (model, options = {}) => {
  const {
    query = {},
    page = 1,
    limit = 10,
    populate = null,
    select = null,
    sort = { createdAt: -1 },
    all = false,
  } = options;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  if (all) {
    let queryBuilder = model.find(query);
    
    if (populate) {
      if (typeof populate === 'string') {
        queryBuilder = queryBuilder.populate(populate);
      } else if (Array.isArray(populate)) {
        populate.forEach(pop => queryBuilder = queryBuilder.populate(pop));
      } else {
        queryBuilder = queryBuilder.populate(populate);
      }
    }
    
    if (select) {
      queryBuilder = queryBuilder.select(select);
    }

    const data = await queryBuilder.sort(sort);

    return {
      data,
      total: data.length,
      pagination: null,
    };
  }

  const skip = (pageNum - 1) * limitNum;

  let queryBuilder = model.find(query);
  
  if (populate) {
    if (typeof populate === 'string') {
      queryBuilder = queryBuilder.populate(populate);
    } else if (Array.isArray(populate)) {
      populate.forEach(pop => queryBuilder = queryBuilder.populate(pop));
    } else {
      queryBuilder = queryBuilder.populate(populate);
    }
  }
  
  if (select) {
    queryBuilder = queryBuilder.select(select);
  }

  const [data, total] = await Promise.all([
    queryBuilder
      .limit(limitNum)
      .skip(skip)
      .sort(sort),
    model.countDocuments(query),
  ]);

  const totalPages = Math.ceil(total / limitNum);

  return {
    data,
    total,
    pagination: {
      currentPage: pageNum,
      totalPages,
      total,
      limit: limitNum,
      hasNext: pageNum < totalPages,
      hasPrev: pageNum > 1,
      nextPage: pageNum < totalPages ? pageNum + 1 : null,
      prevPage: pageNum > 1 ? pageNum - 1 : null,
    },
  };
};

const buildSearchQuery = (searchTerm, searchFields) => {
  if (!searchTerm || !searchFields || searchFields.length === 0) {
    return {};
  }

  return {
    $or: searchFields.map((field) => ({
      [field]: { $regex: searchTerm, $options: "i" },
    })),
  };
};

const buildDateRangeQuery = (dateField, from, to) => {
  const dateQuery = {};

  if (from || to) {
    dateQuery[dateField] = {};
    if (from) dateQuery[dateField].$gte = new Date(from);
    if (to) dateQuery[dateField].$lte = new Date(to);
  }

  return dateQuery;
};

const combineQueries = (...queries) => {
  const validQueries = queries.filter((q) => q && Object.keys(q).length > 0);

  if (validQueries.length === 0) return {};
  if (validQueries.length === 1) return validQueries[0];

  return { $and: validQueries };
};

module.exports = {
  paginate,
  buildSearchQuery,
  buildDateRangeQuery,
  combineQueries,
};
