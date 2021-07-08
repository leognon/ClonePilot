-- Query on https://data.stackexchange.com/stackoverflow/query/new
-- To go to a post by id go to stackoverflow.com/q/id

/*SELECT
p.Id AS [Post Link],
p.Score AS "Q Score",
p.Body AS "Q Body",
p.Tags AS "Tags",
p.AnswerCount AS "Answer Count" ,
a.Body as "Ans Body",
a.Score as "Ans Score"
FROM Posts p
JOIN Posts a ON p.Id = a.ParentId
WHERE
p.PostTypeId = 1 AND
p.ViewCount > 2000000 --AND
--p.AnswerCount > 1
ORDER BY p.Id ASC*/


select
  a.Id, a.Score, a.Body
FROM Posts a
JOIN Posts q ON a.parentId = q.Id
where
  a.PostTypeId = 2 and
  q.Tags LIKE '%javascript%' and
  a.Score > 10000 and
  q.ViewCount > 3000000
